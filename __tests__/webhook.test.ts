import { POST } from '@/app/api/webhook/route'
import * as supabaseModule from '@/lib/supabase'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getServerSupabase: jest.fn(),
}))

const mockGetServerSupabase = supabaseModule.getServerSupabase as jest.Mock

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildMockSupabase(returnData: unknown[], error?: { message: string }) {
  const selectFn = jest.fn().mockResolvedValue({ data: error ? null : returnData, error: error ?? null })
  const upsertFn = jest.fn().mockReturnValue({ select: selectFn })
  return { from: jest.fn().mockReturnValue({ upsert: upsertFn }) }
}

describe('POST /api/webhook', () => {
  afterEach(() => jest.clearAllMocks())

  it('happy path: inserts valid ai_news payload and returns success', async () => {
    const inserted = [{ id: 'uuid-1', rank: 1, topic: 'trending', title: 'Test', summary: 'Summary', link: 'https://example.com', date: '2026-06-27', image: null, created_at: '' }]
    mockGetServerSupabase.mockReturnValue(buildMockSupabase(inserted))

    const req = buildRequest({
      table: 'ai_news',
      items: [{ rank: 1, topic: 'trending', title: 'Test', summary: 'Summary', link: 'https://example.com' }],
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.table).toBe('ai_news')
    expect(json.inserted).toBe(1)
  })

  it('edge case: rejects invalid table name with 400 status', async () => {
    const req = buildRequest({
      table: 'invalid_table',
      items: [{ rank: 1, topic: 'test', title: 'T', summary: 'S', link: 'https://example.com' }],
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/Invalid table/)
  })

  it('error case: returns 500 when Supabase upsert fails', async () => {
    const selectFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB connection error' } })
    const upsertFn = jest.fn().mockReturnValue({ select: selectFn })
    mockGetServerSupabase.mockReturnValue({ from: jest.fn().mockReturnValue({ upsert: upsertFn }) })

    const req = buildRequest({
      table: 'ai_news',
      items: [{ rank: 1, topic: 'trending', title: 'Test', summary: 'S', link: 'https://example.com' }],
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error).toBe('DB connection error')
  })
})
