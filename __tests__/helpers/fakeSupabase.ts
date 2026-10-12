import { randomUUID } from 'crypto'

// Minimal in-memory stand-in for the supabase-js query builder — just the
// methods lib/contentPipeline.ts uses — so claim/submit races can be tested
// against real filter semantics instead of hand-wired mock chains.

type Row = Record<string, unknown>
type Filter = (r: Row) => boolean

const DEFAULTS: Record<string, () => Row> = {
  content_jobs: () => ({ status: 'pending', content: null, error: null, claimed_at: null }),
  image_jobs: () => ({ status: 'pending', image_url: null, error: null, claimed_at: null }),
}

function cmp(op: string, actual: unknown, expected: string): boolean {
  if (actual === null || actual === undefined) return false
  const a = String(actual)
  if (op === 'eq') return a === expected
  if (op === 'lt') return a < expected
  if (op === 'gt') return a > expected
  throw new Error(`fakeSupabase: unsupported op ${op}`)
}

// Splits on commas that are not inside parentheses
function splitTop(expr: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of expr) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) parts.push(cur)
  return parts
}

function parseTerm(term: string): Filter {
  const and = term.match(/^and\((.*)\)$/)
  if (and) {
    const subs = splitTop(and[1]).map(parseTerm)
    return r => subs.every(f => f(r))
  }
  const m = term.match(/^(\w+)\.(eq|lt|gt)\.(.*)$/)
  if (!m) throw new Error(`fakeSupabase: cannot parse filter ${term}`)
  const [, col, op, raw] = m
  const val = raw.replace(/^"(.*)"$/, '$1')
  return r => cmp(op, r[col], val)
}

export function createFakeSupabase(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = { content_jobs: [], image_jobs: [] }
  for (const [t, rows] of Object.entries(seed)) tables[t] = rows.map(r => ({ ...r }))
  const uploads: Array<{ bucket: string; path: string; contentType?: string; size: number }> = []

  class Query {
    private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | null = null
    private payload: Row | Row[] | null = null
    private opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    private filters: Filter[] = []
    private orderBy: { col: string; asc: boolean } | null = null
    private limitN: number | null = null
    private returning = false
    private mode: 'many' | 'single' | 'maybe' = 'many'

    constructor(private table: string) {
      if (!tables[table]) tables[table] = []
    }

    select() {
      if (!this.op) this.op = 'select'
      this.returning = true
      return this
    }
    insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = rows; return this }
    update(values: Row) { this.op = 'update'; this.payload = values; return this }
    upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
      this.op = 'upsert'; this.payload = rows; this.opts = opts; return this
    }
    delete() { this.op = 'delete'; return this }
    eq(col: string, val: unknown) { this.filters.push(r => cmp('eq', r[col], String(val))); return this }
    in(col: string, vals: unknown[]) { this.filters.push(r => vals.map(String).includes(String(r[col]))); return this }
    lt(col: string, val: unknown) { this.filters.push(r => cmp('lt', r[col], String(val))); return this }
    or(expr: string) {
      const terms = splitTop(expr).map(parseTerm)
      this.filters.push(r => terms.some(f => f(r)))
      return this
    }
    order(col: string, o: { ascending?: boolean } = {}) { this.orderBy = { col, asc: o.ascending !== false }; return this }
    limit(n: number) { this.limitN = n; return this }
    single() { this.mode = 'single'; return this }
    maybeSingle() { this.mode = 'maybe'; return this }

    then<T>(res: (v: { data: unknown; error: { message: string; code?: string } | null }) => T, rej?: (e: unknown) => T) {
      return Promise.resolve().then(() => this.exec()).then(res, rej)
    }

    private matched() {
      return tables[this.table].filter(r => this.filters.every(f => f(r)))
    }

    private newRow(r: Row): Row {
      const now = new Date().toISOString()
      return { id: randomUUID(), ...(DEFAULTS[this.table]?.() ?? {}), created_at: now, updated_at: now, ...r }
    }

    private exec() {
      let rows: Row[] = []
      const list = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : []
      if (this.op === 'select') {
        rows = this.matched()
        if (this.orderBy) {
          const { col, asc } = this.orderBy
          rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1))
        }
        if (this.limitN !== null) rows = rows.slice(0, this.limitN)
      } else if (this.op === 'insert') {
        rows = list.map(r => this.newRow(r))
        tables[this.table].push(...rows)
      } else if (this.op === 'upsert') {
        const keys = (this.opts.onConflict ?? 'id').split(',')
        for (const r of list) {
          const existing = tables[this.table].find(e => keys.every(k => String(e[k]) === String(r[k])))
          if (existing) {
            if (!this.opts.ignoreDuplicates) Object.assign(existing, r)
            continue
          }
          const row = this.newRow(r)
          tables[this.table].push(row)
          rows.push(row)
        }
      } else if (this.op === 'update') {
        rows = this.matched()
        for (const r of rows) Object.assign(r, this.payload, { updated_at: new Date().toISOString() })
      } else if (this.op === 'delete') {
        rows = this.matched()
        tables[this.table] = tables[this.table].filter(r => !rows.includes(r))
      }

      if (!this.returning) return { data: null, error: null }
      const copy = rows.map(r => ({ ...r }))
      if (this.mode === 'many') return { data: copy, error: null }
      if (copy.length > 1) return { data: null, error: { message: 'multiple rows returned', code: 'PGRST116' } }
      if (this.mode === 'single' && copy.length === 0) return { data: null, error: { message: 'no rows', code: 'PGRST116' } }
      return { data: copy[0] ?? null, error: null }
    }
  }

  const storage = {
    from(bucket: string) {
      return {
        async upload(path: string, body: Buffer | Uint8Array, opts: { contentType?: string } = {}) {
          uploads.push({ bucket, path, contentType: opts.contentType, size: body.length })
          return { data: { path }, error: null }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}` } }
        },
      }
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = { from: (t: string) => new Query(t), storage } as any
  return { client, tables, uploads }
}
