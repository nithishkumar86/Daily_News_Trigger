import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase, IMAGE_BUCKET } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { istDate } from '@/lib/retention'

const SERVER_INFO = {
  name: 'daily-news-trigger',
  version: '1.0.0',
}

const AI_TOPICS = ['trending', 'ai', 'tools', 'models']
const INVESTMENT_TOPICS = ['startup', 'investment', 'funding', 'company']
const JOB_TOPICS = ['hiring', 'layoffs', 'jobs', 'hr']
const ALL_VALID_TOPICS = [...AI_TOPICS, ...INVESTMENT_TOPICS, ...JOB_TOPICS]

function resolveTable(topic: string): 'ai_news' | 'investment_news' | 'job_hire_fire' | null {
  const t = topic.toLowerCase().trim()
  if (AI_TOPICS.includes(t)) return 'ai_news'
  if (INVESTMENT_TOPICS.includes(t)) return 'investment_news'
  if (JOB_TOPICS.includes(t)) return 'job_hire_fire'
  return null
}

const TOOLS = [
  {
    name: 'send_news',
    description:
      'Send a single news item to the Daily News Trigger database. Call this once per news item, in rank order (1 through 10). Topic automatically routes to the correct table: trending/ai/tools/models → ai_news, startup/investment/funding/company → investment_news, hiring/layoffs/jobs/hr → job_hire_fire. Every call returns a receipt: count an item as sent ONLY when saved is true and record_id is set (saved is only true when both the story and its image were stored). code "image_failed" means the image could not be downloaded or is not a real image, so nothing was saved — generate a fresh image and resend immediately with the same rank. code "slot_taken" means that rank already holds a different story (nothing was overwritten) — resend with a rank from free_ranks. code "duplicate" means the story is already saved — skip it.',
    inputSchema: {
      type: 'object',
      properties: {
        Rank: {
          type: 'string',
          description: 'Rank of the news item (1 = most important, 10 = least important)',
        },
        Topic: {
          type: 'string',
          description: `Category of the news item. Must be one of: ${ALL_VALID_TOPICS.join(', ')}. AI news: trending, ai, tools, models. Investment news: startup, investment, funding, company. Job news: hiring, layoffs, jobs, hr.`,
        },
        Title: {
          type: 'string',
          description: 'Headline of the news article — must be under 20 words (e.g. "OpenAI releases GPT-6 with advanced reasoning")',
        },
        Summary: {
          type: 'string',
          description: 'Detailed summary of the news article — minimum 500 characters. Write at least 4-5 sentences covering what happened, why it matters, and key details.',
        },
        Image: {
          type: 'string',
          description: 'Base64-encoded image or publicly accessible image URL for the news article',
        },
        Link: {
          type: 'string',
          description: 'Full URL to the original news article (must start with http:// or https://)',
        },
        Date: {
          type: 'string',
          description:
            "Optional, informational only: the source article's publish date (YYYY-MM-DD). The server files every item under today's date in India (IST), returned as date in the receipt, so one run always appears together.",
        },
      },
      required: ['Rank', 'Topic', 'Title', 'Summary', 'Image', 'Link'],
    },
  },
]

const REQUIRED_FIELDS = ['Rank', 'Topic', 'Title', 'Summary', 'Image', 'Link'] as const

function validateArgs(args: Record<string, unknown>): string | null {
  // A non-string field would otherwise throw on .trim() and the agent would get
  // no receipt at all.
  for (const k of [...REQUIRED_FIELDS, 'Date']) {
    if (args[k] !== undefined && args[k] !== null && typeof args[k] !== 'string') return `${k} must be a string`
  }
  const missing = REQUIRED_FIELDS.filter(k => !(typeof args[k] === 'string' && (args[k] as string).trim()))
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`
  const { Rank, Topic, Title, Summary, Link } = args as Record<string, string>
  // Whole-number 1-10 only — parseInt alone would accept "3abc"
  if (!/^\d{1,2}$/.test(Rank.trim()) || Number(Rank) < 1 || Number(Rank) > 10) return 'Rank must be a whole number between 1 and 10'
  if (!resolveTable(Topic)) return `Topic "${Topic}" is invalid. Must be one of: ${ALL_VALID_TOPICS.join(', ')}`
  const titleWordCount = Title.trim().split(/\s+/).length
  if (titleWordCount >= 20) return `Title must be under 20 words (current: ${titleWordCount} words)`
  if (Summary.trim().length < 500) return `Summary must be at least 500 characters (current: ${Summary.trim().length})`
  // Must be a parseable http(s) URL; quotes/backslashes/whitespace would also
  // break the Link filter used by the duplicate check.
  const link = Link.trim()
  let parsed: URL | null = null
  try {
    parsed = new URL(link)
  } catch {}
  if (!parsed || !/^https?:$/.test(parsed.protocol)) return 'Link must be a full URL starting with http:// or https://'
  if (/["\\\s]/.test(link)) return 'Link must not contain quotes, backslashes or spaces (percent-encode them)'
  return null
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_FETCH_TIMEOUT_MS = 15_000

const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' } as const
type ImageExt = keyof typeof IMAGE_MIME

// Identify the image from its magic bytes, never from a header the remote
// server controls — an expired link often answers 200 with an HTML error page.
function sniffImage(buf: Buffer): ImageExt | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'gif'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return null
}

type ImageResult =
  | { ok: true; value: string; storagePath: string | null }
  | { ok: false; reason: string }

// The story is only saved when its image is. A URL (the agent's links expire
// in about a minute) is downloaded, verified to be a real image, and uploaded
// to Supabase Storage under a unique name, so it can never overwrite another
// story's file. Inline base64 is verified the same way and stored as-is.
async function resolveImage(
  supabase: SupabaseClient,
  table: string,
  date: string,
  rank: string,
  image: string
): Promise<ImageResult> {
  const value = image.trim()

  if (!/^https?:\/\//i.test(value)) {
    const b64 = value.replace(/^data:image\/[a-z+.-]+;base64,/i, '')
    if (!/^[A-Za-z0-9+/\s]+=*$/.test(b64)) {
      return { ok: false, reason: 'Image is neither an http(s) URL nor valid base64.' }
    }
    const buf = Buffer.from(b64, 'base64')
    if (buf.length > MAX_IMAGE_BYTES) return { ok: false, reason: `Image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` }
    if (!sniffImage(buf)) {
      return { ok: false, reason: 'Image is not an http(s) URL and does not decode as base64 to a PNG, JPEG, GIF or WebP image.' }
    }
    return { ok: true, value, storagePath: null }
  }

  let res: Response
  try {
    res = await fetch(value, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) })
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    return {
      ok: false,
      reason: timedOut
        ? `Image download timed out after ${IMAGE_FETCH_TIMEOUT_MS / 1000}s.`
        : `Image download failed: ${err instanceof Error ? err.message : 'network error'}.`,
    }
  }
  if (!res.ok) {
    return { ok: false, reason: `Image download failed with HTTP ${res.status} (the image link has probably expired).` }
  }
  const declared = Number(res.headers.get('content-length'))
  if (declared > MAX_IMAGE_BYTES) return { ok: false, reason: `Image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` }

  let buf: Buffer
  try {
    buf = Buffer.from(await res.arrayBuffer())
  } catch {
    return { ok: false, reason: 'Image download was interrupted before it finished.' }
  }
  if (buf.length === 0) return { ok: false, reason: 'Image download returned an empty file.' }
  if (buf.length > MAX_IMAGE_BYTES) return { ok: false, reason: `Image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` }
  const ext = sniffImage(buf)
  if (!ext) {
    return {
      ok: false,
      reason: `Image link did not return an image (content-type "${res.headers.get('content-type') ?? 'unknown'}"); the link has probably expired.`,
    }
  }

  // Name keeps the `${date}-rank${rank}` prefix lib/cleanup.ts reads the date from
  const path = `${table}/${date}-rank${rank}-${randomUUID().slice(0, 8)}.${ext}`
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, buf, { contentType: IMAGE_MIME[ext], upsert: false })
  if (error) return { ok: false, reason: `Image upload to storage failed: ${error.message}.` }
  return { ok: true, value: supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl, storagePath: path }
}

// Every send_news result is an explicit receipt: the agent may only count an
// item as sent when saved === true and record_id is present. The same object
// goes in the text block (what 2024-11-05 clients read) and structuredContent.
type FailCode = 'validation' | 'config' | 'db_error' | 'slot_taken' | 'duplicate' | 'image_failed' | 'server_error'

function receipt(body: Record<string, unknown>, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(body) }],
    structuredContent: body,
    ...(isError ? { isError: true } : {}),
  }
}

function fail(code: FailCode, error: string, extra: Record<string, unknown> = {}) {
  return receipt({ success: false, saved: false, record_id: null, code, error, ...extra }, true)
}

// Light normalization so a retry with a trailing slash or #fragment still
// counts as the same story.
function normalizeLink(link: string): string {
  return link.trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase()
}

function linkVariants(link: string): string[] {
  const base = link.trim().replace(/#.*$/, '').replace(/\/+$/, '')
  return [...new Set([link, link.trim(), base, `${base}/`])]
}

// dayRows: the date's rows if already fetched; otherwise (the insert-race path)
// they are re-read so free_ranks reflects the row that just won the slot.
async function slotTaken(
  supabase: SupabaseClient,
  table: string,
  date: string,
  rank: string,
  dayRows?: Array<{ Rank: unknown }>
) {
  const rows = dayRows ?? (await supabase.from(table).select('Rank').eq('Date', date)).data ?? []
  const taken = new Set(rows.map(r => Number(r.Rank)))
  const free_ranks = Array.from({ length: 10 }, (_, i) => i + 1).filter(r => !taken.has(r))
  const next = free_ranks.length
    ? `Resend this story with one of the free ranks: ${free_ranks.join(', ')}.`
    : `All ranks 1-10 for ${date} are full; this story cannot be added today.`
  return fail(
    'slot_taken',
    `Rank ${rank} on ${date} in ${table} already holds a different story; it was NOT overwritten. ${next}`,
    { date, rank, free_ranks }
  )
}

async function handleToolCall(name: string, args: Record<string, string>) {
  if (name !== 'send_news') {
    return { error: { code: -32601, message: `Unknown tool: ${name}` } }
  }

  const validationError = validateArgs(args)
  if (validationError) return fail('validation', validationError)

  const { Topic, Title, Summary, Image, Date: articleDate } = args
  // Canonical forms: "03" → "3", trimmed link, so retries and the duplicate
  // check compare like with like.
  const Rank = String(Number(args.Rank.trim()))
  const Link = args.Link.trim()
  const table = resolveTable(Topic)!
  // The agent's Date is the article's publish date; storing it scattered one
  // run across past date groups (and collided with older ranks). Every item is
  // filed under the IST day it arrives instead.
  const DateVal = istDate(Date.now())

  let supabase
  try {
    supabase = getServerSupabase()
  } catch (err) {
    return fail('config', err instanceof Error ? err.message : 'Supabase config error')
  }

  // Conflict checks run BEFORE the image upload: the image path is keyed by
  // date+rank, so uploading first would clobber the existing story's image
  // even when the send is then rejected.
  const key = normalizeLink(Link)

  // Both lookups in parallel: the function region is far from the database,
  // so every sequential round trip costs hundreds of ms. The day's rows give
  // both the target slot and free_ranks for a rejection.
  const [linkRes, dayRes] = await Promise.all([
    supabase.from(table).select('id, Date, Rank, Link').in('Link', linkVariants(Link)),
    supabase.from(table).select('id, Rank, Link').eq('Date', DateVal),
  ])
  if (linkRes.error) return fail('db_error', linkRes.error.message)
  if (dayRes.error) return fail('db_error', dayRes.error.message)
  const sameLink = linkRes.data ?? []
  const dayRows = dayRes.data ?? []
  const slot = dayRows.find(r => Number(r.Rank) === Number(Rank))

  // The same story re-sent to its own slot is a retry → update in place.
  // A different story never replaces an existing one.
  const isRetry = !!slot && normalizeLink(String(slot.Link)) === key
  if (slot && !isRetry) {
    return slotTaken(supabase, table, DateVal, Rank, dayRows)
  }
  const elsewhere = sameLink.find(r => r.id !== slot?.id)
  if (!isRetry && elsewhere) {
    return fail(
      'duplicate',
      `This story is already saved in ${table} on ${elsewhere.Date} at rank ${elsewhere.Rank} (record_id ${elsewhere.id}). Skip it and send a different story.`,
      { existing: { record_id: elsewhere.id, date: elsewhere.Date, rank: elsewhere.Rank } }
    )
  }

  // No image → nothing is saved, so a story never appears without its picture.
  const image = await resolveImage(supabase, table, DateVal, Rank, Image)
  if (!image.ok) {
    return fail(
      'image_failed',
      `${image.reason} Nothing was saved. Generate a fresh image and resend this story with the same rank immediately.`,
      { image_saved: false }
    )
  }
  const row = { Rank, Topic: Topic.toLowerCase().trim(), Title: Title.trim(), Summary: Summary.trim(), Image: image.value, Link, Date: DateVal }

  // Empty slot → plain insert, so a concurrent send that took the slot first
  // hits the ("Date","Rank") unique index (23505) instead of being overwritten.
  const { data, error } = isRetry
    ? await supabase.from(table).update(row).eq('id', slot!.id).select().single()
    : await supabase.from(table).insert(row).select().single()

  if (error || !data) {
    // The row was not saved — don't leave its freshly uploaded image behind.
    if (image.storagePath) await supabase.storage.from(IMAGE_BUCKET).remove([image.storagePath]).catch(() => {})
    if (error?.code === '23505') return slotTaken(supabase, table, DateVal, Rank)
    return fail('db_error', error?.message ?? 'Database returned no row')
  }

  return receipt({
    success: true,
    saved: true,
    record_id: data.id,
    action: isRetry ? 'updated' : 'inserted',
    table,
    date: data.Date,
    article_date: articleDate ?? null,
    rank: data.Rank,
    title: data.Title,
    image_saved: true,
    image_url: image.storagePath ? data.Image : null,
    data: { id: data.id, Date: data.Date, Rank: data.Rank, Title: data.Title, Link: data.Link },
  })
}

export async function POST(req: NextRequest) {
  let body: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 }
    )
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } },
      { status: 400 }
    )
  }

  const { id, method, params } = body

  if (method === 'initialize') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      },
    })
  }

  if (method === 'notifications/initialized') {
    return new NextResponse(null, { status: 204 })
  }

  if (method === 'tools/list') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS },
    })
  }

  if (method === 'tools/call') {
    const toolName = (params as { name?: string })?.name ?? ''
    const rawArgs = (params as { arguments?: unknown })?.arguments
    const toolArgs = { ...(rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {}) } as Record<string, string>
    // The old handler accepted a numeric Rank via parseInt — keep accepting it
    const numericRank = (toolArgs as Record<string, unknown>).Rank
    if (typeof numericRank === 'number' && Number.isFinite(numericRank)) toolArgs.Rank = String(numericRank)
    // Every tools/call gets a receipt — an unexpected exception must never
    // leave the agent guessing whether the item was saved.
    let result: Awaited<ReturnType<typeof handleToolCall>>
    try {
      result = await handleToolCall(toolName, toolArgs)
    } catch (err) {
      console.error('send_news unexpected error:', err)
      result = fail('server_error', `Unexpected server error: ${err instanceof Error ? err.message : 'unknown'}. Nothing was confirmed saved; resend this story.`)
    }
    if ('error' in result && !('content' in result)) {
      return NextResponse.json({ jsonrpc: '2.0', id, error: result.error })
    }
    return NextResponse.json({ jsonrpc: '2.0', id, result })
  }

  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  })
}

export async function GET() {
  return NextResponse.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    description: 'MCP server for Daily News Trigger — auto-routes news to ai_news, investment_news, or job_hire_fire based on Topic',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  })
}
