import { GET } from '@/app/api/check-cleanup/route'
import * as supabaseModule from '@/lib/supabase'

// End-to-end retention flow with the real route, the real runCleanup and the
// real retentionCutoff. Only the Supabase client is replaced by an in-memory
// store seeded with disposable rows, so no live data is read or deleted.
jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getServerSupabase: jest.fn(),
}))

const mockGetServerSupabase = supabaseModule.getServerSupabase as jest.Mock

const NEWS_TABLES = ['ai_news', 'investment_news', 'job_hire_fire'] as const

interface Row {
  Date: string
}

interface Store {
  rows: Record<string, Row[]>
  files: Record<string, string[]>
  lastCleaned: string | null
  failDeleteOn: string | null
}

function utcDaysBefore(nowMs: number, days: number): string {
  const d = new Date(nowMs)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Minimal in-memory implementation of the query shapes the cleanup path uses.
function buildInMemorySupabase(store: Store) {
  return {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { last_cleaned: store.lastCleaned }, error: null }),
          }),
        }),
        delete: () => ({
          lt: async (column: keyof Row, cutoff: string) => {
            if (store.failDeleteOn === table) {
              return { count: null, error: { message: 'simulated delete failure' } }
            }
            const before = store.rows[table]
            store.rows[table] = before.filter(r => !(r[column] < cutoff))
            return { count: before.length - store.rows[table].length, error: null }
          },
        }),
        upsert: async (value: { last_cleaned: string }) => {
          store.lastCleaned = value.last_cleaned
          return { error: null }
        },
      }
    },
    storage: {
      from: () => ({
        list: async (folder: string) => ({
          data: (store.files[folder] ?? []).map(name => ({ name })),
          error: null,
        }),
        remove: async (paths: string[]) => {
          for (const p of paths) {
            const [folder, name] = p.split('/')
            store.files[folder] = store.files[folder].filter(f => f !== name)
          }
          return { error: null }
        },
      }),
    },
  }
}

// Each table gets a row at today, today−14 (oldest kept) and today−15 (first
// deleted); each bucket folder gets matching image files.
function seedStore(nowMs: number, lastCleaned: string | null): Store {
  const keptDates = [0, 14].map(n => utcDaysBefore(nowMs, n))
  const expiredDate = utcDaysBefore(nowMs, 15)
  const rows: Record<string, Row[]> = {}
  const files: Record<string, string[]> = {}
  for (const t of NEWS_TABLES) {
    rows[t] = [...keptDates, expiredDate].map(d => ({ Date: d }))
    files[t] = [...keptDates, expiredDate].map(d => `${d}-rank1.jpg`)
  }
  return { rows, files, lastCleaned, failDeleteOn: null }
}

describe('retention flow: GET /api/check-cleanup → runCleanup → store', () => {
  let nowMs: number
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    nowMs = Date.now()
    jest.useFakeTimers({ now: nowMs, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
    errorSpy.mockRestore()
  })

  it('happy path: deletes only today−15 rows/images, keeps today−14, stamps today', async () => {
    const store = seedStore(nowMs, utcDaysBefore(nowMs, 1))
    mockGetServerSupabase.mockReturnValue(buildInMemorySupabase(store))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.cleaned).toBe(true)
    expect(body.result).toMatchObject({
      success: true,
      deleted_ai: 1,
      deleted_investment: 1,
      deleted_job: 1,
      deleted_images: 3,
    })
    for (const t of NEWS_TABLES) {
      expect(store.rows[t].map(r => r.Date)).toEqual([utcDaysBefore(nowMs, 0), utcDaysBefore(nowMs, 14)])
      expect(store.files[t]).toHaveLength(2)
    }
    expect(store.lastCleaned).toBe(utcDaysBefore(nowMs, 0))
  })

  it('edge case: a second same-day call is Not due, next_due is tomorrow, nothing more deleted', async () => {
    const store = seedStore(nowMs, null)
    mockGetServerSupabase.mockReturnValue(buildInMemorySupabase(store))

    await GET()
    const res = await GET()
    const body = await res.json()

    expect(body.cleaned).toBe(false)
    expect(body.message).toBe('Not due')
    expect(body.last_cleaned).toBe(utcDaysBefore(nowMs, 0))
    expect(body.next_due).toBe(utcDaysBefore(nowMs, -1))
    for (const t of NEWS_TABLES) expect(store.rows[t]).toHaveLength(2)
  })

  it('error case: a failed delete returns 500, leaves last_cleaned unstamped, and the next call retries', async () => {
    const yesterday = utcDaysBefore(nowMs, 1)
    const store = seedStore(nowMs, yesterday)
    store.failDeleteOn = 'investment_news'
    mockGetServerSupabase.mockReturnValue(buildInMemorySupabase(store))

    const failed = await GET()
    const failedBody = await failed.json()

    expect(failed.status).toBe(500)
    expect(failedBody.result.success).toBe(false)
    expect(store.lastCleaned).toBe(yesterday)
    expect(store.rows.investment_news).toHaveLength(3)

    store.failDeleteOn = null
    const retried = await GET()

    expect(retried.status).toBe(200)
    expect(store.rows.investment_news).toHaveLength(2)
    expect(store.lastCleaned).toBe(utcDaysBefore(nowMs, 0))
  })
})
