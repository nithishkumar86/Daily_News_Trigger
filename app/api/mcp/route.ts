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
      'Send a single news item to the Daily News Trigger database. Call this once per news item, in rank order (1 through 10). Topic automatically routes to the correct table: trending/ai/tools/models → ai_news, startup/investment/funding/company → investment_news, hiring/layoffs/jobs/hr → job_hire_fire. Every call returns a receipt: count an item as sent ONLY when saved is true and record_id is set. code "slot_taken" means that rank already holds a different story (nothing was overwritten) — resend with a rank from free_ranks. code "duplicate" means the story is already saved — skip it.',
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

function validateArgs(args: Record<string, string>): string | null {
  const { Rank, Topic, Title, Summary, Image, Link } = args
  if (!Rank || !Topic || !Title || !Summary || !Image || !Link)
    return 'Missing required fields: Rank, Topic, Title, Summary, Image, Link'
  const rankNum = parseInt(Rank)
  if (isNaN(rankNum) || rankNum < 1 || rankNum > 10) return 'Rank must be a number between 1 and 10'
  if (!resolveTable(Topic)) return `Topic "${Topic}" is invalid. Must be one of: ${ALL_VALID_TOPICS.join(', ')}`
  const titleWordCount = Title.trim().split(/\s+/).length
  if (titleWordCount >= 20) return `Title must be under 20 words (current: ${titleWordCount} words)`
  if (Summary.length < 500) return `Summary must be at least 500 characters (current: ${Summary.length})`
  if (!/^https?:\/\//i.test(Link)) return 'Link must start with http:// or https://'
  return null
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

// Download the agent's (short-lived) image URL and upload it to Supabase
// Storage, returning the permanent public URL. A base64/raw value passes
// through unchanged; on any failure returns null (row still inserts).
async function resolveImage(
  supabase: SupabaseClient,
  table: string,
  date: string,
  rank: string,
  image: string
): Promise<string | null> {
  const url = image?.startsWith('http') ? image : null
  if (!url) return image ?? null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    const path = `${table}/${date}-rank${rank}.${extFromMime(mime)}`
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, buffer, { contentType: mime, upsert: true })
    if (error) return null
    return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

// Every send_news result is an explicit receipt: the agent may only count an
// item as sent when saved === true and record_id is present. The same object
// goes in the text block (what 2024-11-05 clients read) and structuredContent.
type FailCode = 'validation' | 'config' | 'db_error' | 'slot_taken' | 'duplicate'

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

  const { Rank, Topic, Title, Summary, Image, Link, Date: articleDate } = args
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

  // Download the temp image URL and store the permanent Storage URL instead.
  const resolvedImage = await resolveImage(supabase, table, DateVal, Rank, Image)
  const row = { Rank, Topic: Topic.toLowerCase().trim(), Title, Summary, Image: resolvedImage, Link, Date: DateVal }

  // Empty slot → plain insert, so a concurrent send that took the slot first
  // hits the ("Date","Rank") unique index (23505) instead of being overwritten.
  const { data, error } = isRetry
    ? await supabase.from(table).update(row).eq('id', slot!.id).select().single()
    : await supabase.from(table).insert(row).select().single()

  if (error?.code === '23505') return slotTaken(supabase, table, DateVal, Rank)
  if (error || !data) return fail('db_error', error?.message ?? 'Database returned no row')

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
    const toolArgs = ((params as { arguments?: Record<string, string> })?.arguments ?? {}) as Record<string, string>
    const result = await handleToolCall(toolName, toolArgs)
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
