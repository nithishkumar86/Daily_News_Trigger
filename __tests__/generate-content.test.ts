import { POST } from '@/app/api/generate-content/route'
import { NextRequest } from 'next/server'
import fs from 'fs'

jest.mock('fs')
const mockedFs = fs as jest.Mocked<typeof fs>

const mockFetch = jest.fn()
global.fetch = mockFetch

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/generate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const sampleItem = {
  id: 'uuid-1',
  rank: 1,
  topic: 'trending',
  title: 'AI breakthrough',
  summary: 'An important breakthrough in AI.',
  image: null,
  link: 'https://example.com',
  date: '2026-06-27',
  created_at: '',
}

describe('POST /api/generate-content', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    mockedFs.existsSync = jest.fn().mockReturnValue(true)
    mockedFs.readFileSync = jest.fn().mockReturnValue('You are a journalist.')
  })

  afterEach(() => jest.clearAllMocks())

  it('happy path: calls OpenRouter and returns generated content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Generated article text.' } }],
      }),
    })

    const req = buildRequest({ format: 'article', selectedItems: [sampleItem] })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.content).toBe('Generated article text.')
    expect(Array.isArray(json.updatedHistory)).toBe(true)
  })

  it('edge case: returns 400 when format is invalid', async () => {
    const req = buildRequest({ format: 'podcast', selectedItems: [sampleItem] })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/Invalid format/)
  })

  it('error case: returns 500 when OPENROUTER_API_KEY is missing', async () => {
    delete process.env.OPENROUTER_API_KEY

    const req = buildRequest({ format: 'newsletter', selectedItems: [sampleItem] })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toMatch(/OPENROUTER_API_KEY/)
  })
})
