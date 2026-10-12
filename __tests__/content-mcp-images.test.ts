import { createFakeSupabase } from './helpers/fakeSupabase'
import * as supabaseModule from '@/lib/supabase'
import {
  claimImageJob,
  failImageJob,
  listPendingImageJobs,
  MAX_IMAGE_BYTES,
  sniffImage,
  STALE_CLAIM_MS,
  storeImage,
  submitImageUrl,
} from '@/lib/contentPipeline'
import { POST as upload } from '@/app/api/content-mcp/upload/route'

jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getServerSupabase: jest.fn(),
}))
const mockGetServerSupabase = supabaseModule.getServerSupabase as jest.Mock

const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IMG_PENDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const IMG_GENERATING = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const IMG_DONE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()
const png = (size = 4096) => { const b = new Uint8Array(size); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b }
const jpeg = (size = 4096) => { const b = new Uint8Array(size); b.set([0xff, 0xd8, 0xff, 0xe0]); return b }

function seeded() {
  return createFakeSupabase({
    image_jobs: [
      { id: IMG_PENDING, job_id: JOB, section_key: 'tools', title: 'TOP 5 AI TOOL UPDATES', prompt: 'P-tools', status: 'pending', claimed_at: null, created_at: iso(3000) },
      { id: IMG_GENERATING, job_id: JOB, section_key: 'world', title: 'TOP 5 AI NEWS', prompt: 'P-world', status: 'generating', claimed_at: iso(60_000), created_at: iso(4000) },
      { id: IMG_DONE, job_id: JOB, section_key: 'insights', title: 'TOP 5 AI INSIGHTS', prompt: 'P-ins', status: 'done', image_url: 'https://x/old.png', claimed_at: iso(60_000), created_at: iso(5000) },
    ],
  })
}

describe('sniffImage', () => {
  it('identifies PNG, JPEG and WebP from magic bytes and rejects anything else', () => {
    expect(sniffImage(png())).toEqual({ mime: 'image/png', ext: 'png' })
    expect(sniffImage(jpeg())).toEqual({ mime: 'image/jpeg', ext: 'jpg' })
    const webp = new Uint8Array(32); webp.set([...'RIFF'].map(c => c.charCodeAt(0))); webp.set([...'WEBP'].map(c => c.charCodeAt(0)), 8)
    expect(sniffImage(webp)).toEqual({ mime: 'image/webp', ext: 'webp' })
    expect(sniffImage(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).toBeNull()
  })
})

describe('listPendingImageJobs / claimImageJob', () => {
  it('lists only pending (and stale) image jobs', async () => {
    const { client, tables } = seeded()
    let r = await listPendingImageJobs(client)
    expect(r.ok && r.data.image_jobs.map(i => i.image_job_id)).toEqual([IMG_PENDING])
    tables.image_jobs.find(i => i.id === IMG_GENERATING)!.claimed_at = iso(STALE_CLAIM_MS + 1000)
    r = await listPendingImageJobs(client)
    expect(r.ok && r.data.image_jobs.map(i => i.image_job_id)).toEqual([IMG_GENERATING, IMG_PENDING])
  })

  it('claims once, returns the prompt, and refuses taken / done jobs', async () => {
    const { client } = seeded()
    expect(await claimImageJob(client, IMG_PENDING)).toEqual({
      ok: true,
      data: { image_job_id: IMG_PENDING, section_key: 'tools', title: 'TOP 5 AI TOOL UPDATES', prompt: 'P-tools' },
    })
    expect(await claimImageJob(client, IMG_PENDING)).toEqual({ ok: false, error: expect.stringMatching(/already taken/) })
    expect(await claimImageJob(client, IMG_DONE)).toEqual({ ok: false, error: expect.stringMatching(/already done/) })
    expect(await claimImageJob(client, 'x')).toEqual({ ok: false, error: 'image_job_id must be a UUID' })
  })
})

describe('storeImage', () => {
  it('uploads a claimed image to Storage and marks it done', async () => {
    const { client, tables, uploads } = seeded()
    const r = await storeImage(client, IMG_GENERATING, png())
    expect(r.ok).toBe(true)
    expect(uploads).toEqual([{ bucket: 'news-images', path: `generated/${JOB}/world.png`, contentType: 'image/png', size: 4096 }])
    const row = tables.image_jobs.find(i => i.id === IMG_GENERATING)!
    expect(row.status).toBe('done')
    expect(row.image_url).toBe(`https://fake.supabase.co/storage/v1/object/public/news-images/generated/${JOB}/world.png`)
  })

  it('never replaces a done image and refuses an unclaimed one', async () => {
    const { client, tables, uploads } = seeded()
    expect(await storeImage(client, IMG_DONE, png())).toEqual({ ok: false, error: expect.stringMatching(/image job is done/) })
    expect(await storeImage(client, IMG_PENDING, png())).toEqual({ ok: false, error: expect.stringMatching(/claim it first/) })
    expect(uploads).toHaveLength(0)
    expect(tables.image_jobs.find(i => i.id === IMG_DONE)!.image_url).toBe('https://x/old.png')
  })

  it('rejects non-images, tiny files and files over the size cap', async () => {
    const { client, uploads } = seeded()
    expect((await storeImage(client, IMG_GENERATING, new Uint8Array(4096))).ok).toBe(false)
    expect((await storeImage(client, IMG_GENERATING, png(100))).ok).toBe(false)
    expect((await storeImage(client, IMG_GENERATING, png(MAX_IMAGE_BYTES + 1))).ok).toBe(false)
    expect(uploads).toHaveLength(0)
  })
})

describe('submitImageUrl', () => {
  const realFetch = global.fetch
  afterEach(() => { global.fetch = realFetch })

  it.each(['http://cdn.example.com/a.png', 'https://localhost/a.png', 'https://127.0.0.1/a.png', 'https://[::1]/a.png', 'file:///etc/passwd', 'nope'])(
    'refuses unsafe URL %s without fetching',
    async url => {
      global.fetch = jest.fn()
      const { client } = seeded()
      expect(await submitImageUrl(client, IMG_GENERATING, url)).toEqual({ ok: false, error: 'image_url must be a public https URL' })
      expect(global.fetch).not.toHaveBeenCalled()
    }
  )

  it('downloads a public https image and stores it', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(jpeg(), { status: 200, headers: { 'content-type': 'image/jpeg' } }))
    const { client, uploads } = seeded()
    const r = await submitImageUrl(client, IMG_GENERATING, 'https://files.example.com/out.jpg')
    expect(r.ok).toBe(true)
    expect(uploads[0].path).toBe(`generated/${JOB}/world.jpg`)
  })
})

describe('failImageJob', () => {
  it('fails a claimed image job but never a done one', async () => {
    const { client, tables } = seeded()
    expect((await failImageJob(client, IMG_GENERATING, 'model refused')).ok).toBe(true)
    expect(tables.image_jobs.find(i => i.id === IMG_GENERATING)!.status).toBe('failed')
    expect((await failImageJob(client, IMG_DONE, 'x')).ok).toBe(false)
  })
})

describe('POST /api/content-mcp/upload', () => {
  const KEY = 'test-upload-key-0123456789'
  const post = (id: string | null, body: Uint8Array, headers: Record<string, string> = {}, key: string | null = KEY) => {
    const qs = new URLSearchParams()
    if (id) qs.set('id', id)
    if (key !== null) qs.set('key', key)
    const url = `http://localhost/api/content-mcp/upload?${qs}`
    return upload(Object.assign(new Request(url, {
      method: 'POST', headers: { 'Content-Type': 'image/png', ...headers }, body,
    }), { nextUrl: new URL(url) }) as never)
  }

  let fake: ReturnType<typeof seeded>
  const savedKey = process.env.CONTENT_MCP_KEY
  beforeEach(() => { process.env.CONTENT_MCP_KEY = KEY; fake = seeded(); mockGetServerSupabase.mockReturnValue(fake.client) })
  afterAll(() => { process.env.CONTENT_MCP_KEY = savedKey })

  it('refuses a missing or wrong key (401) and a server with no key set (500), storing nothing', async () => {
    expect((await post(IMG_GENERATING, png(), {}, null)).status).toBe(401)
    expect((await post(IMG_GENERATING, png(), {}, 'wrong')).status).toBe(401)
    expect((await post(IMG_GENERATING, png(), {}, KEY + 'x')).status).toBe(401)
    delete process.env.CONTENT_MCP_KEY
    expect((await post(IMG_GENERATING, png(), {}, KEY)).status).toBe(500)
    expect(fake.tables.image_jobs.find(i => i.id === IMG_GENERATING)!.status).toBe('generating')
  })

  it('stores a claimed image (200) and refuses a second upload (409)', async () => {
    const res = await post(IMG_GENERATING, png())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, status: 'done' })
    expect((await post(IMG_GENERATING, png())).status).toBe(409)
  })

  it('maps bad input to 400 / 404 / 409 / 413', async () => {
    expect((await post(null, png())).status).toBe(400)
    expect((await post('55555555-5555-4555-8555-555555555555', png())).status).toBe(404)
    expect((await post(IMG_PENDING, png())).status).toBe(409)
    expect((await post(IMG_GENERATING, new TextEncoder().encode('x'.repeat(2000)))).status).toBe(400)
    expect((await post(IMG_GENERATING, png(), { 'content-length': String(MAX_IMAGE_BYTES + 1) })).status).toBe(413)
  })
})
