import { runCleanup } from '@/lib/cleanup'
import * as supabaseModule from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getServerSupabase: jest.fn(),
  AI_NEWS_TABLE: 'ai_news',
  INVESTMENT_NEWS_TABLE: 'investment_news',
  CLEANUP_LOG_TABLE: 'cleanup_log',
}))

const mockGetServerSupabase = supabaseModule.getServerSupabase as jest.Mock

function buildMockSupabase(aiCount: number | null, invCount: number | null, upsertError?: Error) {
  const upsert = upsertError
    ? jest.fn().mockRejectedValue(upsertError)
    : jest.fn().mockResolvedValue({ error: null })

  const makeMockChain = (count: number | null) => {
    const chain: Record<string, jest.Mock> = {}
    chain.delete = jest.fn().mockReturnValue(chain)
    chain.lt = jest.fn().mockResolvedValue({ count, error: null })
    return chain
  }

  return {
    from: jest.fn((table: string) => {
      if (table === 'ai_news') return makeMockChain(aiCount)
      if (table === 'investment_news') return makeMockChain(invCount)
      return { upsert, select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
    }),
  }
}

describe('runCleanup', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('happy path: returns correct deleted counts when rows exist', async () => {
    const mockSupabase = {
      from: jest.fn((table: string) => {
        const chain: Record<string, jest.Mock> = {}
        if (table === 'ai_news') {
          chain.delete = jest.fn().mockReturnValue(chain)
          chain.lt = jest.fn().mockResolvedValue({ count: 3, error: null })
          return chain
        }
        if (table === 'investment_news') {
          chain.delete = jest.fn().mockReturnValue(chain)
          chain.lt = jest.fn().mockResolvedValue({ count: 2, error: null })
          return chain
        }
        // cleanup_log upsert chain
        return { upsert: jest.fn().mockResolvedValue({ error: null }) }
      }),
    }
    mockGetServerSupabase.mockReturnValue(mockSupabase)

    const result = await runCleanup()

    expect(result.deleted_ai).toBe(3)
    expect(result.deleted_investment).toBe(2)
  })

  it('edge case: returns zero counts when no rows older than 7 days exist', async () => {
    const mockSupabase = {
      from: jest.fn((table: string) => {
        const chain: Record<string, jest.Mock> = {}
        if (table === 'ai_news' || table === 'investment_news') {
          chain.delete = jest.fn().mockReturnValue(chain)
          chain.lt = jest.fn().mockResolvedValue({ count: null, error: null })
          return chain
        }
        return { upsert: jest.fn().mockResolvedValue({ error: null }) }
      }),
    }
    mockGetServerSupabase.mockReturnValue(mockSupabase)

    const result = await runCleanup()

    expect(result.deleted_ai).toBe(0)
    expect(result.deleted_investment).toBe(0)
  })

  it('error case: propagates error when getServerSupabase throws', async () => {
    mockGetServerSupabase.mockImplementation(() => {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    })

    await expect(runCleanup()).rejects.toThrow('Missing SUPABASE_SERVICE_ROLE_KEY')
  })
})
