import { runCleanup } from '@/lib/cleanup'
import * as supabaseModule from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getServerSupabase: jest.fn(),
  AI_NEWS_TABLE: 'ai_news',
  INVESTMENT_NEWS_TABLE: 'investment_news',
  JOB_NEWS_TABLE: 'job_hire_fire',
  CLEANUP_LOG_TABLE: 'cleanup_log',
}))

const mockGetServerSupabase = supabaseModule.getServerSupabase as jest.Mock

interface TableOutcome {
  count: number | null
  error?: { message: string }
}

// One mock client for all delete-path tests. Each news table resolves its own
// count so a mis-wired table branch surfaces as a wrong `deleted_*` value.
// `upsert` is shared so tests can assert whether the log was stamped, and each
// table's `lt` mock is exposed so tests can assert the cutoff it received.
function buildMockSupabase(
  ai: TableOutcome,
  inv: TableOutcome,
  job: TableOutcome
) {
  const upsert = jest.fn().mockResolvedValue({ error: null })
  const ltByTable: Record<string, jest.Mock> = {}

  const makeMockChain = (table: string, outcome: TableOutcome) => {
    const chain: Record<string, jest.Mock> = {}
    chain.delete = jest.fn().mockReturnValue(chain)
    chain.lt = jest
      .fn()
      .mockResolvedValue({ count: outcome.count, error: outcome.error ?? null })
    ltByTable[table] = chain.lt
    return chain
  }

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'ai_news') return makeMockChain(table, ai)
      if (table === 'investment_news') return makeMockChain(table, inv)
      if (table === 'job_hire_fire') return makeMockChain(table, job)
      return { upsert }
    }),
  }

  return { client, upsert, ltByTable }
}

// Calendar date N days before `nowMs` (UTC), derived independently of
// lib/retention so the cutoff assertion is not tautological.
function utcDaysBefore(nowMs: number, days: number): string {
  const d = new Date(nowMs)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const ok = (count: number | null): TableOutcome => ({ count })

describe('runCleanup', () => {
  let errorSpy: jest.SpyInstance
  // Frozen at the real current instant — runtime-derived, never hardcoded.
  let nowMs: number

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

  it('happy path: returns correct deleted counts and stamps last_cleaned', async () => {
    const { client, upsert } = buildMockSupabase(ok(3), ok(2), ok(4))
    mockGetServerSupabase.mockReturnValue(client)

    const result = await runCleanup()

    expect(result.deleted_ai).toBe(3)
    expect(result.deleted_investment).toBe(2)
    expect(result.deleted_job).toBe(4)
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(
      { id: 1, last_cleaned: utcDaysBefore(nowMs, 0) },
      { onConflict: 'id' }
    )
  })

  it('happy path: deletes every table with the 15-day rolling cutoff (today−14)', async () => {
    const { client, ltByTable } = buildMockSupabase(ok(0), ok(0), ok(0))
    mockGetServerSupabase.mockReturnValue(client)

    await runCleanup()

    const expectedCutoff = utcDaysBefore(nowMs, 14)
    for (const table of ['ai_news', 'investment_news', 'job_hire_fire']) {
      expect(ltByTable[table]).toHaveBeenCalledTimes(1)
      expect(ltByTable[table]).toHaveBeenCalledWith('Date', expectedCutoff)
    }
  })

  it('edge case: returns zero counts when no rows fall outside the retention window', async () => {
    const { client } = buildMockSupabase(ok(null), ok(null), ok(null))
    mockGetServerSupabase.mockReturnValue(client)

    const result = await runCleanup()

    expect(result.deleted_ai).toBe(0)
    expect(result.deleted_investment).toBe(0)
    expect(result.deleted_job).toBe(0)
    expect(result.success).toBe(true)
  })

  it('error case: a failed delete surfaces the error and does NOT stamp last_cleaned', async () => {
    const { client, upsert } = buildMockSupabase(
      { count: null, error: { message: 'column "date" does not exist' } },
      ok(2),
      ok(0)
    )
    mockGetServerSupabase.mockReturnValue(client)

    const result = await runCleanup()

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('ai_news')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('error case: propagates error when getServerSupabase throws', async () => {
    mockGetServerSupabase.mockImplementation(() => {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    })

    await expect(runCleanup()).rejects.toThrow('Missing SUPABASE_SERVICE_ROLE_KEY')
  })
})
