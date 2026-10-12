import { createFakeSupabase } from './helpers/fakeSupabase'
import * as supabaseModule from '@/lib/supabase'
import { POST } from '@/app/api/content-jobs/route'

jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getServerSupabase: jest.fn(),
}))
const mockGetServerSupabase = supabaseModule.getServerSupabase as jest.Mock

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/content-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as never)

const story = (over: Record<string, unknown> = {}) => ({
  Rank: 1, Date: '2026-10-11', Title: 'GPT-5.6 launches', Topic: 'tools',
  Summary: 'OpenAI introduced GPT-5.6.', Link: 'https://openai.com', ...over,
})

describe('POST /api/content-jobs', () => {
  let fake: ReturnType<typeof createFakeSupabase>
  beforeEach(() => { fake = createFakeSupabase(); mockGetServerSupabase.mockReturnValue(fake.client) })

  it('creates a pending newsletter job with cleaned items (201)', async () => {
    const res = await post({
      kind: 'newsletter',
      items: [story({ Section: 'AI tools update of the week', Title: 'Line\nbreak injection', Image: 'data:huge', id: 'x' })],
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ job_id: expect.any(String), status: 'pending' })

    const row = fake.tables.content_jobs[0]
    expect(row).toMatchObject({ id: body.job_id, kind: 'newsletter', status: 'pending' })
    // Only the generation fields are kept, newlines stripped, no Image / id passthrough
    expect(row.items).toEqual([{
      Rank: 1, Date: '2026-10-11', Title: 'Line break injection', Topic: 'tools',
      Summary: 'OpenAI introduced GPT-5.6.', Link: 'https://openai.com', Section: 'AI tools update of the week',
    }])
  })

  it('creates an article job without needing a Section', async () => {
    const res = await post({ kind: 'article', items: [story()] })
    expect(res.status).toBe(201)
    expect(fake.tables.content_jobs[0].items).toEqual([expect.not.objectContaining({ Section: expect.anything() })])
  })

  it.each([
    ['bad JSON', '{', /Invalid JSON/],
    ['an array body', [], /Invalid request body/],
    ['an unknown kind', { kind: 'linkedin', items: [story()] }, /kind must be one of/],
    ['no items', { kind: 'article', items: [] }, /cannot be empty/],
    ['too many newsletter items', { kind: 'newsletter', items: Array(31).fill(story({ Section: 'AI Insights' })) }, /Maximum is 30/],
    ['too many article items', { kind: 'article', items: Array(21).fill(story()) }, /Maximum is 20/],
    ['a newsletter item without a valid Section', { kind: 'newsletter', items: [story({ Section: 'Made up' })] }, /needs a Section/],
    ['an item without a Title', { kind: 'article', items: [story({ Title: '  ' })] }, /needs a Title/],
  ])('rejects %s with 400 and writes nothing', async (_label, body, msg) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(msg)
    expect(fake.tables.content_jobs).toHaveLength(0)
  })

  it('caps long fields', async () => {
    await post({ kind: 'article', items: [story({ Title: 'T'.repeat(500), Summary: 'S'.repeat(5000) })] })
    const [item] = fake.tables.content_jobs[0].items as Array<Record<string, string>>
    expect(item.Title).toHaveLength(300)
    expect(item.Summary).toHaveLength(2000)
  })
})
