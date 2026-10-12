import { createFakeSupabase } from './helpers/fakeSupabase'
import * as supabaseModule from '@/lib/supabase'
import {
  claimContentJob,
  failContentJob,
  getFormat,
  listPendingContentJobs,
  STALE_CLAIM_MS,
  submitContent,
} from '@/lib/contentPipeline'
import { POST } from '@/app/api/content-mcp/route'

jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getServerSupabase: jest.fn(),
}))
const mockGetServerSupabase = supabaseModule.getServerSupabase as jest.Mock

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'
const ID_C = '33333333-3333-4333-8333-333333333333'
const ID_D = '44444444-4444-4444-8444-444444444444'

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()
const items = [{ Title: 'GPT-5.6 launches', Section: 'AI tools update of the week' }]

const newsletterPrompts = ['world', 'tools', 'insights', 'trending'].map(k => ({
  section_key: k,
  title: `TOP 5 ${k.toUpperCase()}`,
  prompt: `A wide 16:9 infographic about ${k}`,
}))

function seeded() {
  return createFakeSupabase({
    content_jobs: [
      { id: ID_A, kind: 'newsletter', items, status: 'pending', claimed_at: null, created_at: iso(3000) },
      { id: ID_B, kind: 'article', items, status: 'pending', claimed_at: null, created_at: iso(2000) },
      { id: ID_C, kind: 'newsletter', items, status: 'writing', claimed_at: iso(60_000), created_at: iso(5000) },
      { id: ID_D, kind: 'newsletter', items, status: 'written', claimed_at: iso(60_000), created_at: iso(9000) },
    ],
  })
}

describe('getFormat', () => {
  it('returns the newsletter, article and image-prompt instructions', async () => {
    for (const name of ['newsletter', 'article', 'image-prompt']) {
      const r = await getFormat(name)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.content.length).toBeGreaterThan(200)
    }
  })

  it('refuses anything outside the allowlist (no path traversal)', async () => {
    for (const name of ['../.env.local', 'routine-claude', '', 42]) {
      expect((await getFormat(name)).ok).toBe(false)
    }
  })
})

describe('listPendingContentJobs', () => {
  it('lists pending jobs oldest first and hides claimed/written ones', async () => {
    const { client } = seeded()
    const r = await listPendingContentJobs(client)
    expect(r).toEqual({ ok: true, data: { jobs: [expect.objectContaining({ job_id: ID_A }), expect.objectContaining({ job_id: ID_B })] } })
  })

  it('includes a job whose claim went stale (the run died)', async () => {
    const { client, tables } = seeded()
    tables.content_jobs.find(j => j.id === ID_C)!.claimed_at = iso(STALE_CLAIM_MS + 60_000)
    const r = await listPendingContentJobs(client)
    expect(r.ok && r.data.jobs.map(j => j.job_id)).toEqual([ID_C, ID_A, ID_B])
  })
})

describe('claimContentJob', () => {
  it('claims a pending job once and returns its kind and items', async () => {
    const { client, tables } = seeded()
    const first = await claimContentJob(client, ID_A)
    expect(first).toEqual({ ok: true, data: { job_id: ID_A, kind: 'newsletter', items } })
    expect(tables.content_jobs.find(j => j.id === ID_A)!.status).toBe('writing')

    const second = await claimContentJob(client, ID_A)
    expect(second).toEqual({ ok: false, error: expect.stringMatching(/already taken/) })
  })

  it('refuses written jobs and unknown / malformed ids', async () => {
    const { client } = seeded()
    expect(await claimContentJob(client, ID_D)).toEqual({ ok: false, error: expect.stringMatching(/already written/) })
    expect(await claimContentJob(client, '55555555-5555-4555-8555-555555555555')).toEqual({ ok: false, error: 'not found' })
    expect(await claimContentJob(client, "1' or '1'='1")).toEqual({ ok: false, error: 'job_id must be a UUID' })
  })

  it('re-claims a stale writing job', async () => {
    const { client, tables } = seeded()
    tables.content_jobs.find(j => j.id === ID_C)!.claimed_at = iso(STALE_CLAIM_MS + 1000)
    expect((await claimContentJob(client, ID_C)).ok).toBe(true)
  })
})

describe('submitContent', () => {
  it('refuses a job that was not claimed', async () => {
    const { client, tables } = seeded()
    const r = await submitContent(client, ID_A, 'text', newsletterPrompts)
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/claim it first/) })
    expect(tables.image_jobs).toHaveLength(0)
  })

  it('saves content + 4 pending image jobs for a claimed newsletter, exactly once', async () => {
    const { client, tables } = seeded()
    await claimContentJob(client, ID_A)
    const r = await submitContent(client, ID_A, '  Weekly Digest  ', newsletterPrompts)
    expect(r).toEqual({ ok: true, data: { job_id: ID_A, status: 'written', image_jobs: ['world', 'tools', 'insights', 'trending'] } })

    const job = tables.content_jobs.find(j => j.id === ID_A)!
    expect(job).toMatchObject({ status: 'written', content: 'Weekly Digest' })
    expect(tables.image_jobs).toHaveLength(4)
    expect(tables.image_jobs.every(i => i.status === 'pending' && i.job_id === ID_A)).toBe(true)

    // A second submit can't overwrite the written job or duplicate its images
    const again = await submitContent(client, ID_A, 'other', newsletterPrompts)
    expect(again.ok).toBe(false)
    expect(job.content).toBe('Weekly Digest')
    expect(tables.image_jobs).toHaveLength(4)
  })

  it('accepts exactly one hero prompt for an article', async () => {
    const { client, tables } = seeded()
    await claimContentJob(client, ID_B)
    const r = await submitContent(client, ID_B, 'Article', [{ section_key: 'hero', title: 'Headline', prompt: 'hero image' }])
    expect(r.ok).toBe(true)
    expect(tables.image_jobs.map(i => i.section_key)).toEqual(['hero'])
  })

  it.each([
    ['a missing section', newsletterPrompts.slice(0, 3), /missing image prompts for: trending/],
    ['a duplicate section', [...newsletterPrompts, newsletterPrompts[0]], /duplicate section_key/],
    ['a section from the other kind', [...newsletterPrompts.slice(0, 3), { section_key: 'hero', title: 't', prompt: 'p' }], /section_key must be one of/],
    ['an empty prompt', newsletterPrompts.map((p, i) => (i === 0 ? { ...p, prompt: ' ' } : p)), /prompt is required/],
    ['a non-array', 'nope', /must be an array/],
  ])('rejects image prompts with %s and leaves the job claimable', async (_label, prompts, msg) => {
    const { client, tables } = seeded()
    await claimContentJob(client, ID_A)
    const r = await submitContent(client, ID_A, 'text', prompts)
    expect(r).toEqual({ ok: false, error: expect.stringMatching(msg) })
    expect(tables.content_jobs.find(j => j.id === ID_A)!.status).toBe('writing')
    expect(tables.image_jobs).toHaveLength(0)
  })

  it('rejects empty and oversized content', async () => {
    const { client } = seeded()
    await claimContentJob(client, ID_A)
    expect((await submitContent(client, ID_A, '', newsletterPrompts)).ok).toBe(false)
    expect((await submitContent(client, ID_A, 'x'.repeat(60_001), newsletterPrompts)).ok).toBe(false)
  })
})

describe('failContentJob', () => {
  it('fails a claimed job with a capped reason, but never a written one', async () => {
    const { client, tables } = seeded()
    await claimContentJob(client, ID_A)
    expect((await failContentJob(client, ID_A, 'x'.repeat(900))).ok).toBe(true)
    const job = tables.content_jobs.find(j => j.id === ID_A)!
    expect(job.status).toBe('failed')
    expect((job.error as string).length).toBe(500)
    expect(await failContentJob(client, ID_D, 'nope')).toEqual({ ok: false, error: 'job not found or already finished' })
  })
})

describe('POST /api/content-mcp (JSON-RPC)', () => {
  const KEY = 'test-mcp-key-0123456789'
  const rpc = (method: string, params?: object, key: string | null = KEY) =>
    POST(new Request(`http://localhost/api/content-mcp${key === null ? '' : `?key=${encodeURIComponent(key)}`}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }) as never)

  const savedKey = process.env.CONTENT_MCP_KEY
  beforeEach(() => { process.env.CONTENT_MCP_KEY = KEY; mockGetServerSupabase.mockReturnValue(seeded().client) })
  afterAll(() => { process.env.CONTENT_MCP_KEY = savedKey })

  it('refuses a missing or wrong key (401) and a server with no key set (500)', async () => {
    const fake = seeded()
    mockGetServerSupabase.mockReturnValue(fake.client)
    expect((await rpc('tools/list', undefined, null)).status).toBe(401)
    expect((await rpc('initialize', undefined, 'wrong')).status).toBe(401)
    const claim = await rpc('tools/call', { name: 'claim_content_job', arguments: { job_id: ID_A } }, KEY.slice(0, -1))
    expect(claim.status).toBe(401)
    expect(fake.tables.content_jobs.find(j => j.id === ID_A)!.status).toBe('pending')
    process.env.CONTENT_MCP_KEY = '  '
    expect((await rpc('tools/list')).status).toBe(500)
  })

  it('accepts the key even when the env value has stray whitespace', async () => {
    process.env.CONTENT_MCP_KEY = `  ${KEY}\n`
    expect((await rpc('ping')).status).toBe(200)
  })

  it('initializes and lists the writer tools', async () => {
    expect((await (await rpc('initialize')).json()).result.serverInfo.name).toBe('content-pipeline')
    const names = (await (await rpc('tools/list')).json()).result.tools.map((t: { name: string }) => t.name)
    expect(names).toEqual(expect.arrayContaining(['get_format', 'list_pending_content_jobs', 'claim_content_job', 'submit_content', 'fail_content_job']))
  })

  it('has no URL-fetching submit_image tool (images arrive only through /upload)', async () => {
    const names = (await (await rpc('tools/list')).json()).result.tools.map((t: { name: string }) => t.name)
    expect(names).not.toContain('submit_image')
    const call = await (await rpc('tools/call', { name: 'submit_image', arguments: { image_job_id: ID_A, image_url: 'https://x.y/a.png' } })).json()
    expect(call.error.code).toBe(-32601)
  })

  it('returns get_format as raw markdown text', async () => {
    const body = await (await rpc('tools/call', { name: 'get_format', arguments: { name: 'image-prompt' } })).json()
    expect(body.result.content[0].text).toContain('TOP 5 AI TOOL UPDATES')
  })

  it('runs claim → submit over the wire and flags tool errors', async () => {
    const claim = await (await rpc('tools/call', { name: 'claim_content_job', arguments: { job_id: ID_A } })).json()
    expect(JSON.parse(claim.result.content[0].text)).toMatchObject({ success: true, kind: 'newsletter' })

    const submit = await (await rpc('tools/call', {
      name: 'submit_content',
      arguments: { job_id: ID_A, content: 'Digest', image_prompts: newsletterPrompts },
    })).json()
    expect(JSON.parse(submit.result.content[0].text)).toMatchObject({ success: true, status: 'written' })

    const dup = await (await rpc('tools/call', { name: 'claim_content_job', arguments: { job_id: ID_A } })).json()
    expect(dup.result.isError).toBe(true)
  })

  it('negotiates the protocol version, acks notifications, answers ping, and 405s GET', async () => {
    const init = async (v?: string) => (await (await rpc('initialize', v ? { protocolVersion: v } : {})).json()).result.protocolVersion
    expect(await init('2025-06-18')).toBe('2025-06-18')
    expect(await init('1999-01-01')).toBe('2024-11-05')
    expect(await init()).toBe('2024-11-05')
    expect((await rpc('notifications/initialized')).status).toBe(202)
    expect((await rpc('notifications/cancelled')).status).toBe(202)
    expect((await (await rpc('ping')).json()).result).toEqual({})
    const { GET } = await import('@/app/api/content-mcp/route')
    const get = await GET()
    expect(get.status).toBe(405)
    expect(get.headers.get('Allow')).toBe('POST')
  })

  it('answers unknown tools/methods and bad JSON with JSON-RPC errors', async () => {
    expect((await (await rpc('tools/call', { name: 'drop_tables' })).json()).error.code).toBe(-32601)
    expect((await (await rpc('resources/list')).json()).error.code).toBe(-32601)
    const bad = await POST(new Request(`http://localhost/api/content-mcp?key=${KEY}`, { method: 'POST', body: '{' }) as never)
    expect(bad.status).toBe(400)
  })
})
