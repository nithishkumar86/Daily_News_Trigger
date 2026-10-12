import { GET } from '@/app/api/check-cleanup/route'
import * as supabaseModule from '@/lib/supabase'
import * as cleanupModule from '@/lib/cleanup'

jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getServerSupabase: jest.fn(),
  CLEANUP_LOG_TABLE: 'cleanup_log',
}))
jest.mock('@/lib/cleanup', () => ({ runCleanup: jest.fn() }))

const mockGetServerSupabase = supabaseModule.getServerSupabase as jest.Mock
const mockRunCleanup = cleanupModule.runCleanup as jest.Mock

// Builds a client whose cleanup_log read resolves to the given last_cleaned.
function buildMockSupabase(lastCleaned: string | null) {
  const chain: Record<string, jest.Mock> = {}
  chain.select = jest.fn().mockReturnValue(chain)
  chain.eq = jest.fn().mockReturnValue(chain)
  chain.single = jest
    .fn()
    .mockResolvedValue({ data: { last_cleaned: lastCleaned }, error: null })
  return { from: jest.fn().mockReturnValue(chain) }
}

// Calendar date N days before the (frozen) current instant, derived at runtime
// — never hardcoded. Negative N gives a future date.
function daysAgo(days: number): string {
  const d = new Date(Date.now())
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const successResult = {
  success: true,
  deleted_ai: 5,
  deleted_investment: 2,
  deleted_job: 0,
  deleted_images: 3,
  errors: [],
}

describe('GET /api/check-cleanup', () => {
  beforeEach(() => {
    // Freeze the clock at the real current instant so the route and the test
    // agree on "today" even across a UTC midnight.
    jest.useFakeTimers({
      now: Date.now(),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    })
    mockRunCleanup.mockResolvedValue(successResult)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('happy path: runs cleanup when last_cleaned is several days old', async () => {
    mockGetServerSupabase.mockReturnValue(buildMockSupabase(daysAgo(3)))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.cleaned).toBe(true)
    expect(body.result.deleted_ai).toBe(5)
    expect(mockRunCleanup).toHaveBeenCalledTimes(1)
  })

  it('happy path: runs cleanup when last_cleaned is null (never cleaned)', async () => {
    mockGetServerSupabase.mockReturnValue(buildMockSupabase(null))

    const res = await GET()
    const body = await res.json()

    expect(body.cleaned).toBe(true)
    expect(mockRunCleanup).toHaveBeenCalledTimes(1)
  })

  it('boundary: runs cleanup when last_cleaned is exactly 1 day old (yesterday)', async () => {
    mockGetServerSupabase.mockReturnValue(buildMockSupabase(daysAgo(1)))

    const res = await GET()
    const body = await res.json()

    expect(body.cleaned).toBe(true)
    expect(mockRunCleanup).toHaveBeenCalledTimes(1)
  })

  it('edge case: skips when last_cleaned is today and next_due is tomorrow', async () => {
    const today = daysAgo(0)
    mockGetServerSupabase.mockReturnValue(buildMockSupabase(today))

    const res = await GET()
    const body = await res.json()

    expect(body.cleaned).toBe(false)
    expect(body.message).toBe('Not due')
    expect(body.last_cleaned).toBe(today)
    expect(body.next_due).toBe(daysAgo(-1))
    expect(mockRunCleanup).not.toHaveBeenCalled()
  })

  it('edge case: runs cleanup when last_cleaned is malformed (treated as never cleaned)', async () => {
    mockGetServerSupabase.mockReturnValue(buildMockSupabase('not-a-date'))

    const res = await GET()
    const body = await res.json()

    expect(body.cleaned).toBe(true)
    expect(mockRunCleanup).toHaveBeenCalledTimes(1)
  })

  it('error case: returns 500 when a delete failed inside runCleanup', async () => {
    mockGetServerSupabase.mockReturnValue(buildMockSupabase(daysAgo(30)))
    mockRunCleanup.mockResolvedValue({
      ...successResult,
      success: false,
      errors: ['ai_news: column "date" does not exist'],
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.cleaned).toBe(true)
    expect(body.result.errors).toHaveLength(1)
  })

  it('error case: returns 500 when the Supabase client cannot be created', async () => {
    mockGetServerSupabase.mockImplementation(() => {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Missing SUPABASE_SERVICE_ROLE_KEY')
    expect(mockRunCleanup).not.toHaveBeenCalled()
  })
})
