import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase, IMAGE_BUCKET } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

const SERVER_INFO = {
  name: 'daily-news-trigger',
  version: '1.0.0',
}

const AI_TOPICS = ['trending', 'ai', 'tools', 'models']
const INVESTMENT_TOPICS = ['startup', 'investment', 'funding', 'company']
const ALL_VALID_TOPICS = [...AI_TOPICS, ...INVESTMENT_TOPICS]

function resolveTable(topic: string): 'ai_news' | 'investment_news' | null {
  const t = topic.toLowerCase().trim()
  if (AI_TOPICS.includes(t)) return 'ai_news'
  if (INVESTMENT_TOPICS.includes(t)) return 'investment_news'
  return null
}

const TOOLS = [
  {
    name: 'send_news',
    description:
      'Send a single news item to the Daily News Trigger database. Call this once per news item, in rank order (1 through 10). Topic automatically routes to the correct table: trending/ai/tools/models → ai_news, startup/investment/funding/company → investment_news.',
    inputSchema: {
      type: 'object',
      properties: {
        Rank: {
          type: 'string',
          description: 'Rank of the news item (1 = most important, 10 = least important)',
        },
        Topic: {
          type: 'string',
          description: `Category of the news item. Must be one of: ${ALL_VALID_TOPICS.join(', ')}. AI news: trending, ai, tools, models. Investment news: startup, investment, funding, company.`,
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
          description: 'Date of the news item in YYYY-MM-DD format',
        },
      },
      required: ['Rank', 'Topic', 'Title', 'Summary', 'Image', 'Link', 'Date'],
    },
  },
]

function validateArgs(args: Record<string, string>): string | null {
  const { Rank, Topic, Title, Summary, Image, Link, Date: DateVal } = args
  if (!Rank || !Topic || !Title || !Summary || !Image || !Link || !DateVal)
    return 'Missing required fields: Rank, Topic, Title, Summary, Image, Link, Date'
  const rankNum = parseInt(Rank)
  if (isNaN(rankNum) || rankNum < 1 || rankNum > 10) return 'Rank must be a number between 1 and 10'
  if (!resolveTable(Topic)) return `Topic "${Topic}" is invalid. Must be one of: ${ALL_VALID_TOPICS.join(', ')}`
  const titleWordCount = Title.trim().split(/\s+/).length
  if (titleWordCount >= 20) return `Title must be under 20 words (current: ${titleWordCount} words)`
  if (Summary.length < 500) return `Summary must be at least 500 characters (current: ${Summary.length})`
  if (!/^https?:\/\//i.test(Link)) return 'Link must start with http:// or https://'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DateVal)) return 'Date must be in YYYY-MM-DD format'
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

async function handleToolCall(name: string, args: Record<string, string>) {
  if (name !== 'send_news') {
    return { error: { code: -32601, message: `Unknown tool: ${name}` } }
  }

  const validationError = validateArgs(args)
  if (validationError) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: validationError }) }],
      isError: true,
    }
  }

  const { Rank, Topic, Title, Summary, Image, Link, Date: DateVal } = args
  const table = resolveTable(Topic)!

  let supabase
  try {
    supabase = getServerSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Supabase config error'
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: msg }) }],
      isError: true,
    }
  }

  // Download the temp image URL and store the permanent Storage URL instead.
  const resolvedImage = await resolveImage(supabase, table, DateVal, Rank, Image)

  const { data, error } = await supabase
    .from(table)
    .insert({ Rank, Topic: Topic.toLowerCase().trim(), Title, Summary, Image: resolvedImage, Link, Date: DateVal })
    .select()
    .single()

  if (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }],
      isError: true,
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, table, data }) }],
  }
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
    description: 'MCP server for Daily News Trigger — auto-routes news to ai_news or investment_news based on Topic',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  })
}
