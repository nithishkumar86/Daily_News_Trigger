import { NextRequest } from 'next/server'

// In-memory stand-in for the parts of supabase-js the send_news tool uses.
// Enforces the real ("Date","Rank") unique index so insert races behave like Postgres.
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const uploads: string[] = []
let nextId = 1

function makeQuery(table: string) {
  const filters: Array<(r: Row) => boolean> = []
  let op: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  let payload: Row = {}
  let conflictCols: string[] = []
  const rows = () => (tables[table] ??= [])

  function run(): { data: Row[] | null; error: { message: string; code?: string } | null } {
    if (op === 'select') return { data: rows().filter(r => filters.every(f => f(r))), error: null }
    if (op === 'insert') {
      if (rows().some(r => r.Date === payload.Date && String(r.Rank) === String(payload.Rank)))
        return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }
      const row = { id: nextId++, ...payload }
      rows().push(row)
      return { data: [row], error: null }
    }
    if (op === 'update') {
      const hit = rows().filter(r => filters.every(f => f(r)))
      hit.forEach(r => Object.assign(r, payload))
      return { data: hit, error: null }
    }
    const existing = rows().find(r => conflictCols.every(c => String(r[c]) === String(payload[c])))
    if (existing) {
      Object.assign(existing, payload)
      return { data: [existing], error: null }
    }
    const row = { id: nextId++, ...payload }
    rows().push(row)
    return { data: [row], error: null }
  }

  const q = {
    select: () => q,
    insert: (p: Row) => ((op = 'insert'), (payload = p), q),
    update: (p: Row) => ((op = 'update'), (payload = p), q),
    upsert: (p: Row, o: { onConflict: string }) => ((op = 'upsert'), (payload = p), (conflictCols = o.onConflict.split(',')), q),
    eq: (c: string, v: unknown) => (filters.push(r => String(r[c]) === String(v)), q),
    in: (c: string, vs: unknown[]) => (filters.push(r => vs.map(String).includes(String(r[c]))), q),
    order: () => q,
    limit: () => q,
    single: async () => {
      const { data, error } = run()
      if (error) return { data: null, error }
      return data && data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'not single' } }
    },
    maybeSingle: async () => {
      const { data, error } = run()
      return { data: data?.[0] ?? null, error }
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
  }
  return q
}

const fakeClient = {
  from: (t: string) => makeQuery(t),
  storage: {
    from: () => ({
      upload: async (path: string) => (uploads.push(path), { error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
    }),
  },
}

jest.mock('@/lib/supabase', () => ({
  getServerSupabase: () => fakeClient,
  IMAGE_BUCKET: 'news-images',
}))

import { POST } from '@/app/api/mcp/route'

const SUMMARY = 'S'.repeat(520)

function args(over: Record<string, string> = {}) {
  return {
    Rank: '1',
    Topic: 'ai',
    Title: 'A short headline',
    Summary: SUMMARY,
    Image: 'https://img.test/a.png',
    Link: 'https://news.test/story-a',
    Date: '2026-10-14',
    ...over,
  }
}

async function send(a: Record<string, string>) {
  const req = new NextRequest('http://localhost/api/mcp', {
    method: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'send_news', arguments: a } }),
  })
  const json = await (await POST(req)).json()
  const result = json.result
  return { result, receipt: JSON.parse(result.content[0].text) }
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-16T10:00:00Z'))
  for (const k of Object.keys(tables)) delete tables[k]
  uploads.length = 0
  nextId = 1
  global.fetch = jest.fn(async () => ({
    ok: true,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => new ArrayBuffer(4),
  })) as unknown as typeof fetch
})

afterEach(() => jest.restoreAllMocks())

describe('send_news receipt', () => {
  it('returns saved:true with the record_id of the stored row', async () => {
    const { result, receipt } = await send(args())
    expect(result.isError).toBeUndefined()
    expect(receipt).toMatchObject({ success: true, saved: true, table: 'ai_news', rank: '1', title: 'A short headline' })
    expect(receipt.record_id).toBe(tables.ai_news[0].id)
    expect(receipt.data.id).toBe(receipt.record_id)
  })

  it('mirrors the text receipt in structuredContent', async () => {
    const { result, receipt } = await send(args())
    expect(result.structuredContent).toEqual(receipt)
  })

  it('does not echo the Summary or image back in the receipt', async () => {
    const { receipt } = await send(args())
    expect(JSON.stringify(receipt)).not.toContain(SUMMARY)
    expect(receipt.data.Image).toBeUndefined()
  })

  it('returns saved:false, record_id:null and code "validation" on bad input, with no write', async () => {
    const { result, receipt } = await send(args({ Summary: 'too short' }))
    expect(result.isError).toBe(true)
    expect(receipt).toMatchObject({ success: false, saved: false, record_id: null, code: 'validation' })
    expect(receipt.error).toMatch(/at least 500 characters/)
    expect(tables.ai_news ?? []).toHaveLength(0)
    expect(uploads).toHaveLength(0)
  })

  it('reports action "inserted" for a new story', async () => {
    expect((await send(args())).receipt.action).toBe('inserted')
  })

  it('routes investment and job topics to their own tables in the receipt', async () => {
    expect((await send(args({ Topic: 'funding' }))).receipt.table).toBe('investment_news')
    expect((await send(args({ Topic: 'hiring' }))).receipt.table).toBe('job_hire_fire')
  })
})

describe('send_news never overwrites a different story', () => {
  it('rejects a different story on a taken slot with slot_taken, keeps the old row, uploads no image', async () => {
    await send(args({ Link: 'https://news.test/old', Title: 'Old story' }))
    uploads.length = 0
    ;(global.fetch as jest.Mock).mockClear()

    const { result, receipt } = await send(args({ Link: 'https://news.test/new', Title: 'New story' }))
    expect(result.isError).toBe(true)
    expect(receipt).toMatchObject({ saved: false, code: 'slot_taken', free_ranks: [2, 3, 4, 5, 6, 7, 8, 9, 10] })
    expect(receipt.error).toMatch(/NOT overwritten/)
    expect(tables.ai_news).toHaveLength(1)
    expect(tables.ai_news[0].Title).toBe('Old story')
    // The existing story's image must not be clobbered by a rejected send
    expect(uploads).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('says the day is full when all ten ranks are taken', async () => {
    for (let r = 1; r <= 10; r++) await send(args({ Rank: String(r), Link: `https://news.test/${r}` }))
    const { receipt } = await send(args({ Rank: '3', Link: 'https://news.test/extra' }))
    expect(receipt).toMatchObject({ code: 'slot_taken', free_ranks: [] })
    expect(receipt.error).toMatch(/full/)
  })

  it('treats the same story re-sent to its own slot as a retry and updates in place', async () => {
    const first = (await send(args({ Title: 'First title' }))).receipt
    const { result, receipt } = await send(args({ Title: 'Fixed title', Link: 'https://news.test/story-a/#top' }))
    expect(result.isError).toBeUndefined()
    expect(receipt).toMatchObject({ saved: true, action: 'updated', record_id: first.record_id })
    expect(tables.ai_news).toHaveLength(1)
    expect(tables.ai_news[0].Title).toBe('Fixed title')
  })

  it('rejects a story already saved at another date/rank as duplicate', async () => {
    await send(args({ Date: '2026-10-14', Rank: '1' }))
    const { result, receipt } = await send(args({ Date: '2026-10-14', Rank: '2', Link: 'https://news.test/story-a/' }))
    expect(result.isError).toBe(true)
    expect(receipt).toMatchObject({ saved: false, code: 'duplicate', existing: { date: '2026-10-16', rank: '1' } })
    expect(tables.ai_news).toHaveLength(1)
  })

  it('maps a unique-index race (23505) to slot_taken instead of overwriting', async () => {
    // Slot looks free at check time, but another send takes it before the insert
    tables.ai_news = []
    const origFrom = fakeClient.from
    let calls = 0
    fakeClient.from = (t: string) => {
      calls++
      // 3rd call is the insert — slip a competing row in just before it
      if (calls === 3) tables.ai_news.push({ id: 999, Date: '2026-10-16', Rank: '1', Link: 'https://news.test/racer', Title: 'Racer' })
      return origFrom(t)
    }
    try {
      const { receipt } = await send(args())
      expect(receipt).toMatchObject({ saved: false, code: 'slot_taken' })
      expect(tables.ai_news.find(r => r.id === 999)?.Title).toBe('Racer')
    } finally {
      fakeClient.from = origFrom
    }
  })

  it('keeps the same guard for investment_news and job_hire_fire', async () => {
    for (const Topic of ['funding', 'hiring']) {
      await send(args({ Topic, Link: `https://news.test/${Topic}-1` }))
      const { receipt } = await send(args({ Topic, Link: `https://news.test/${Topic}-2` }))
      expect(receipt.code).toBe('slot_taken')
    }
    expect(tables.investment_news).toHaveLength(1)
    expect(tables.job_hire_fire).toHaveLength(1)
  })
})

describe('send_news files every item under the IST arrival date', () => {
  it("ignores the article's own Date for storage and echoes it as article_date", async () => {
    const { receipt } = await send(args({ Date: '2026-10-12' }))
    expect(receipt).toMatchObject({ saved: true, date: '2026-10-16', article_date: '2026-10-12' })
    expect(tables.ai_news[0].Date).toBe('2026-10-16')
  })

  it('accepts a send with no Date, or a malformed one, since it is informational only', async () => {
    expect((await send(args({ Date: '' }))).receipt.saved).toBe(true)
    expect((await send(args({ Rank: '2', Link: 'https://news.test/b', Date: 'Oct 12' }))).receipt.saved).toBe(true)
  })

  it('puts a whole run with mixed article dates into one date group', async () => {
    const dates = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16']
    for (let i = 0; i < dates.length; i++)
      await send(args({ Rank: String(i + 1), Link: `https://news.test/${i}`, Date: dates[i] }))
    expect(new Set(tables.ai_news.map(r => r.Date))).toEqual(new Set(['2026-10-16']))
  })

  it('rolls to the next day at IST midnight (18:30 UTC), not UTC midnight', async () => {
    ;(Date.now as jest.Mock).mockReturnValue(Date.parse('2026-10-16T18:29:59Z'))
    expect((await send(args({ Rank: '1', Link: 'https://news.test/late' }))).receipt.date).toBe('2026-10-16')
    ;(Date.now as jest.Mock).mockReturnValue(Date.parse('2026-10-16T18:30:00Z'))
    expect((await send(args({ Rank: '1', Link: 'https://news.test/early' }))).receipt.date).toBe('2026-10-17')
  })

  it('stores the IST date in investment_news and job_hire_fire too', async () => {
    await send(args({ Topic: 'funding', Date: '2026-10-11' }))
    await send(args({ Topic: 'layoffs', Date: '2026-10-11' }))
    expect(tables.investment_news[0].Date).toBe('2026-10-16')
    expect(tables.job_hire_fire[0].Date).toBe('2026-10-16')
  })

  it('no longer lists Date as a required tool argument', async () => {
    const req = new NextRequest('http://localhost/api/mcp', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const tool = (await (await POST(req)).json()).result.tools[0]
    expect(tool.inputSchema.required).not.toContain('Date')
    expect(tool.inputSchema.properties.Date).toBeDefined()
  })
})
