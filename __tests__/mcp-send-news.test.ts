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

const removed: string[] = []
let uploadError: string | null = null

const fakeClient = {
  from: (t: string) => makeQuery(t),
  storage: {
    from: () => ({
      upload: async (path: string, _buf: Buffer, opts: { upsert?: boolean }) => {
        if (uploadError) return { error: { message: uploadError } }
        // Mirror Storage: with upsert:false an existing object is never replaced
        if (!opts?.upsert && uploads.includes(path)) return { error: { message: 'The resource already exists' } }
        uploads.push(path)
        return { error: null }
      },
      remove: async (paths: string[]) => {
        removed.push(...paths)
        for (const p of paths) uploads.splice(uploads.indexOf(p), 1)
        return { error: null }
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
    }),
  },
}

// Real magic bytes, so the route's image sniffing sees genuine files
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16])
const HTML = Buffer.from('<html><body>AccessDenied: link expired</body></html>')

// Streams the body in chunks like a real fetch Response; stats.pulled counts
// chunks the route actually read, stats.cancelled records an early stop.
function mockImageResponse(
  body: Buffer,
  opts: { status?: number; type?: string; length?: string | null; location?: string; chunk?: number; chunks?: number } = {}
) {
  const status = opts.status ?? 200
  const stats = { pulled: 0, cancelled: false }
  const chunkSize = opts.chunk ?? Math.max(body.length, 1)
  let offset = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      // opts.chunks: an endless body of repeated chunks (no Content-Length)
      if (opts.chunks !== undefined) {
        if (stats.pulled >= opts.chunks) return ctrl.close()
        stats.pulled++
        return ctrl.enqueue(new Uint8Array(chunkSize))
      }
      if (offset >= body.length) return ctrl.close()
      stats.pulled++
      ctrl.enqueue(new Uint8Array(body.subarray(offset, offset + chunkSize)))
      offset += chunkSize
    },
    cancel() {
      stats.cancelled = true
    },
  })
  const headers: Record<string, string | null> = {
    'content-type': opts.type ?? 'image/png',
    'content-length': opts.length === undefined ? String(body.length) : opts.length,
    location: opts.location ?? null,
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => headers[h.toLowerCase()] ?? null },
    body: stream,
    stats,
  }
}

const dnsLookup = jest.fn()
jest.mock('dns/promises', () => ({ lookup: (...a: unknown[]) => dnsLookup(...a) }))

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
  removed.length = 0
  uploadError = null
  nextId = 1
  global.fetch = jest.fn(async () => mockImageResponse(PNG)) as unknown as typeof fetch
  dnsLookup.mockReset()
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
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

describe('send_news only reports success when the story AND its image are saved', () => {
  const fetchMock = () => global.fetch as jest.Mock

  it('success receipt carries image_saved:true and the permanent storage image_url, stored on the row', async () => {
    const { receipt } = await send(args())
    expect(receipt).toMatchObject({ saved: true, image_saved: true })
    expect(receipt.image_url).toMatch(/^https:\/\/storage\.test\/ai_news\/2026-10-16-rank1-[0-9a-f]{8}\.png$/)
    expect(tables.ai_news[0].Image).toBe(receipt.image_url)
    expect(uploads).toHaveLength(1)
  })

  it('names the file by its real bytes (JPEG served as image/png is stored as .jpg)', async () => {
    fetchMock().mockResolvedValueOnce(mockImageResponse(JPG, { type: 'image/png' }))
    expect((await send(args())).receipt.image_url).toMatch(/\.jpg$/)
  })

  const GENERIC =
    'The image link could not be downloaded as a PNG, JPEG, GIF or WebP image (public http(s) links only, max 10 MB). Nothing was saved. Generate a fresh image and resend this story with the same rank immediately.'

  const failures: Array<[string, () => unknown]> = [
    ['an expired link (HTTP 403)', () => mockImageResponse(HTML, { status: 403, type: 'application/xml' })],
    ['a missing image (HTTP 404)', () => mockImageResponse(HTML, { status: 404, type: 'text/html' })],
    ['an expired link that answers 200 with an HTML page', () => mockImageResponse(HTML, { type: 'text/html' })],
    ['an empty file', () => mockImageResponse(Buffer.alloc(0))],
    ['a file over 10 MB (declared)', () => mockImageResponse(PNG, { length: String(11 * 1024 * 1024) })],
    ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
    ['a timeout', () => Promise.reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))],
  ]

  // Every download failure returns the SAME text: no status code, content-type
  // or network error reaches the caller, so the open endpoint can't be used to
  // probe what the server can reach.
  it.each(failures)('saves NOTHING and returns the one generic image_failed receipt for %s', async (_label, response) => {
    fetchMock().mockImplementationOnce(response)
    const { result, receipt } = await send(args())
    expect(result.isError).toBe(true)
    expect(receipt).toMatchObject({ success: false, saved: false, record_id: null, code: 'image_failed', image_saved: false })
    expect(receipt.error).toBe(GENERIC)
    expect(tables.ai_news ?? []).toHaveLength(0)
    expect(uploads).toHaveLength(0)
  })

  it('logs the real failure reason server-side only', async () => {
    fetchMock().mockImplementationOnce(() => mockImageResponse(HTML, { status: 403 }))
    const { receipt } = await send(args())
    expect(receipt.error).not.toMatch(/403/)
    expect(console.warn).toHaveBeenCalledWith('send_news image rejected:', 'HTTP 403', 'img.test')
  })

  it('saves nothing when the storage upload fails, without echoing the storage error', async () => {
    uploadError = 'bucket unavailable'
    const { receipt } = await send(args())
    expect(receipt).toMatchObject({ saved: false, code: 'image_failed' })
    expect(receipt.error).toMatch(/^The image could not be stored\. Nothing was saved/)
    expect(receipt.error).not.toMatch(/bucket unavailable/)
    expect(tables.ai_news ?? []).toHaveLength(0)
  })

  it('passes the download a timeout signal so a hanging link cannot hang the request', async () => {
    await send(args())
    expect(fetchMock().mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('accepts a real base64 image (raw or data URI) and stores it inline', async () => {
    const raw = await send(args({ Image: PNG.toString('base64') }))
    expect(raw.receipt).toMatchObject({ saved: true, image_saved: true, image_url: null })
    const uri = await send(args({ Rank: '2', Link: 'https://news.test/b', Image: `data:image/jpeg;base64,${JPG.toString('base64')}` }))
    expect(uri.receipt.saved).toBe(true)
    expect(tables.ai_news.map(r => r.Image)).toEqual([PNG.toString('base64'), `data:image/jpeg;base64,${JPG.toString('base64')}`])
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('rejects base64 that is not an image, and text that is neither URL nor base64', async () => {
    const notImage = await send(args({ Image: HTML.toString('base64') }))
    expect(notImage.receipt).toMatchObject({ saved: false, code: 'image_failed' })
    const junk = await send(args({ Image: 'no image available' }))
    expect(junk.receipt).toMatchObject({ saved: false, code: 'image_failed' })
    expect(tables.ai_news ?? []).toHaveLength(0)
  })

  it('removes the just-uploaded image when the row insert then fails (23505 race)', async () => {
    const origFrom = fakeClient.from
    let calls = 0
    fakeClient.from = (t: string) => {
      if (++calls === 3) tables.ai_news = [{ id: 999, Date: '2026-10-16', Rank: '1', Link: 'https://news.test/racer', Title: 'Racer', Image: 'https://storage.test/racer.png' }]
      return origFrom(t)
    }
    try {
      const { receipt } = await send(args())
      expect(receipt).toMatchObject({ saved: false, code: 'slot_taken' })
      expect(removed).toHaveLength(1)
      expect(uploads).toHaveLength(0)
      expect(tables.ai_news[0]).toMatchObject({ id: 999, Image: 'https://storage.test/racer.png' })
    } finally {
      fakeClient.from = origFrom
    }
  })

  it('never reuses an image file name, so no story can overwrite another story\'s image', async () => {
    await send(args({ Title: 'v1' }))
    await send(args({ Title: 'v2' })) // same link, same slot → retry/update with a fresh file
    expect(uploads).toHaveLength(2)
    expect(new Set(uploads).size).toBe(2)
  })
})

describe('send_news input hardening — every call gets a receipt', () => {
  async function rpc(body: unknown) {
    const req = new NextRequest('http://localhost/api/mcp', { method: 'POST', body: JSON.stringify(body) })
    const res = await POST(req)
    return { status: res.status, json: await res.json() }
  }

  it.each([
    ['an object Title', { Title: { x: 1 } }],
    ['an array Summary', { Summary: ['a'] }],
    ['a number Image', { Image: 42 }],
  ])('returns a validation receipt (not a crash) for %s', async (_l, over) => {
    const { json } = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'send_news', arguments: { ...args(), ...over } } })
    const r = JSON.parse(json.result.content[0].text)
    expect(r).toMatchObject({ saved: false, code: 'validation' })
    expect(r.error).toMatch(/must be a string/)
    expect(tables.ai_news ?? []).toHaveLength(0)
  })

  it('accepts a numeric Rank (the old handler did) and stores it as a string', async () => {
    const { json } = await (async () => {
      const req = new NextRequest('http://localhost/api/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'send_news', arguments: { ...args(), Rank: 4 } } }) })
      return { json: await (await POST(req)).json() }
    })()
    expect(JSON.parse(json.result.content[0].text)).toMatchObject({ saved: true, rank: '4' })
    expect(tables.ai_news[0].Rank).toBe('4')
  })

  it.each(['3abc', '0', '11', '1.5', '-2', ' '])('rejects Rank %p', async Rank => {
    const { receipt } = await send(args({ Rank }))
    expect(receipt).toMatchObject({ saved: false, code: 'validation' })
  })

  it('normalizes Rank "03" to "3" and trims Link before saving', async () => {
    const { receipt } = await send(args({ Rank: ' 03 ', Link: '  https://news.test/story-a  ' }))
    expect(receipt).toMatchObject({ saved: true, rank: '3' })
    expect(tables.ai_news[0]).toMatchObject({ Rank: '3', Link: 'https://news.test/story-a' })
  })

  it('rejects whitespace-only Title/Summary and a whitespace-padded short Summary', async () => {
    expect((await send(args({ Title: '   ' }))).receipt.error).toMatch(/Missing required fields: Title/)
    expect((await send(args({ Summary: ' '.repeat(600) }))).receipt.error).toMatch(/Missing required fields: Summary/)
    expect((await send(args({ Summary: 'x'.repeat(100) + ' '.repeat(500) }))).receipt.error).toMatch(/at least 500/)
  })

  it.each([
    ['not a URL', 'news article'],
    ['a non-http scheme', 'ftp://news.test/a'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a quote that would break the duplicate filter', 'https://news.test/a"b'],
    ['a backslash', String.raw`https://news.test/a\b`],
  ])('rejects a Link that is %s', async (_l, Link) => {
    const { receipt } = await send(args({ Link }))
    expect(receipt).toMatchObject({ saved: false, code: 'validation' })
    expect(tables.ai_news ?? []).toHaveLength(0)
  })

  it('accepts a Link with commas and parentheses (quoted safely in the filter)', async () => {
    expect((await send(args({ Link: 'https://news.test/a,(b)' }))).receipt.saved).toBe(true)
  })

  it('turns an unexpected exception into a server_error receipt', async () => {
    const origFrom = fakeClient.from
    fakeClient.from = () => {
      throw new Error('boom')
    }
    try {
      const { result, receipt } = await send(args())
      expect(result.isError).toBe(true)
      expect(receipt).toMatchObject({ success: false, saved: false, code: 'server_error' })
      expect(receipt.error).toMatch(/boom/)
    } finally {
      fakeClient.from = origFrom
    }
  })

  it('treats non-object arguments as missing fields, not a crash', async () => {
    const { json } = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'send_news', arguments: ['x'] } })
    expect(JSON.parse(json.result.content[0].text)).toMatchObject({ code: 'validation' })
  })

  it.each([null, [1, 2], 'text'])('answers an invalid JSON-RPC body %p with -32600, not a crash', async body => {
    const { status, json } = await rpc(body)
    expect(status).toBe(400)
    expect(json.error.code).toBe(-32600)
  })
})

describe('send_news image download is restricted to public hosts (SSRF)', () => {
  const fetchMock = () => global.fetch as jest.Mock

  async function expectBlocked(Image: string) {
    const { receipt } = await send(args({ Image }))
    expect(receipt).toMatchObject({ saved: false, code: 'image_failed' })
    expect(fetchMock()).not.toHaveBeenCalled()
    expect(tables.ai_news ?? []).toHaveLength(0)
  }

  it.each([
    'http://127.0.0.1/a.png',
    'http://10.0.0.5/a.png',
    'http://172.16.4.4/a.png',
    'http://192.168.1.1/a.png',
    'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1/a.png',
    'http://0.0.0.0/a.png',
    'http://[::1]/a.png',
    'http://[fd00::1]/a.png',
    'http://[fe80::1]/a.png',
    'http://[::ffff:127.0.0.1]/a.png',
    'http://[::ffff:a9fe:a9fe]/a.png',
  ])('never requests the internal address %s', async url => {
    await expectBlocked(url)
  })

  it('never requests a hostname that resolves to a private address', async () => {
    dnsLookup.mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }])
    await expectBlocked('https://internal.example/a.png')
  })

  it('blocks a hostname when ANY of its addresses is private', async () => {
    dnsLookup.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ])
    await expectBlocked('https://mixed.example/a.png')
  })

  it.each(['https://img.test:8080/a.png', 'https://user:pw@img.test/a.png'])('blocks non-default ports and URL credentials: %s', async url => {
    await expectBlocked(url)
  })

  it('blocks when DNS lookup fails', async () => {
    dnsLookup.mockRejectedValueOnce(new Error('ENOTFOUND'))
    await expectBlocked('https://nowhere.example/a.png')
  })

  it('disables automatic redirects', async () => {
    await send(args())
    expect(fetchMock().mock.calls[0][1].redirect).toBe('manual')
  })

  it('follows a redirect to a public host and saves the image', async () => {
    fetchMock()
      .mockResolvedValueOnce(mockImageResponse(Buffer.alloc(0), { status: 302, location: 'https://cdn.test/real.png' }))
      .mockResolvedValueOnce(mockImageResponse(PNG))
    const { receipt } = await send(args())
    expect(receipt).toMatchObject({ saved: true, image_saved: true })
    expect(String(fetchMock().mock.calls[1][0])).toBe('https://cdn.test/real.png')
  })

  it('re-checks every redirect hop and refuses one that points inside the network', async () => {
    fetchMock().mockResolvedValueOnce(mockImageResponse(Buffer.alloc(0), { status: 302, location: 'http://169.254.169.254/latest/meta-data' }))
    const { receipt } = await send(args())
    expect(receipt).toMatchObject({ saved: false, code: 'image_failed' })
    expect(fetchMock()).toHaveBeenCalledTimes(1)
  })

  it('gives up after 3 redirects', async () => {
    fetchMock().mockImplementation(async () => mockImageResponse(Buffer.alloc(0), { status: 302, location: 'https://loop.test/next' }))
    const { receipt } = await send(args())
    expect(receipt).toMatchObject({ saved: false, code: 'image_failed' })
    expect(fetchMock()).toHaveBeenCalledTimes(4)
  })

  it('returns the same text for a blocked internal address as for an expired link', async () => {
    const internal = (await send(args({ Image: 'http://169.254.169.254/x' }))).receipt.error
    fetchMock().mockImplementationOnce(async () => mockImageResponse(HTML, { status: 403 }))
    const expired = (await send(args())).receipt.error
    expect(internal).toBe(expired)
  })
})

describe('send_news image size cap cannot be bypassed', () => {
  const fetchMock = () => global.fetch as jest.Mock

  it('stops reading an endless body with no Content-Length right after 10 MB', async () => {
    // 1 MB chunks, 1000 available, no Content-Length header
    const res = mockImageResponse(PNG, { length: null, chunk: 1024 * 1024, chunks: 1000 })
    fetchMock().mockResolvedValueOnce(res)
    const { receipt } = await send(args())
    expect(receipt).toMatchObject({ saved: false, code: 'image_failed' })
    expect(res.stats.cancelled).toBe(true)
    expect(res.stats.pulled).toBeLessThanOrEqual(12)
    expect(uploads).toHaveLength(0)
  })

  it('stops reading when Content-Length lies (says small, sends large)', async () => {
    const res = mockImageResponse(PNG, { length: '1000', chunk: 1024 * 1024, chunks: 1000 })
    fetchMock().mockResolvedValueOnce(res)
    const { receipt } = await send(args())
    expect(receipt).toMatchObject({ saved: false, code: 'image_failed' })
    expect(res.stats.cancelled).toBe(true)
    expect(res.stats.pulled).toBeLessThanOrEqual(12)
  })

  it('accepts an image just under the cap delivered in many chunks', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024 - PNG.length)])
    fetchMock().mockResolvedValueOnce(mockImageResponse(big, { length: null, chunk: 64 * 1024 }))
    expect((await send(args())).receipt).toMatchObject({ saved: true, image_saved: true })
  })
})
