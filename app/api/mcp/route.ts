import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, TABLE_NAME } from '@/lib/supabase'

const SERVER_INFO = {
  name: 'daily-news-trigger',
  version: '1.0.0',
}

const TOOLS = [
  {
    name: 'send_news',
    description:
      'Send a single news item to the Daily News Trigger database. Call this once per news item, in rank order (1 through 5).',
    inputSchema: {
      type: 'object',
      properties: {
        Rank: {
          type: 'string',
          description: 'Rank of the news item (1 = most important, 5 = least important)',
        },
        Topic: {
          type: 'string',
          description: 'Category or topic of the news item (e.g. AI, Finance, Technology)',
        },
        Title: {
          type: 'string',
          description: 'Headline of the news article',
        },
        Summary: {
          type: 'string',
          description: 'Brief summary of the news article (2-3 sentences)',
        },
        Image: {
          type: 'string',
          description: 'Base64-encoded image or image URL for the news article (optional)',
        },
        Link: {
          type: 'string',
          description: 'URL link to the full news article',
        },
        Date: {
          type: 'string',
          description: 'Date of the news item in YYYY-MM-DD format (optional, defaults to today)',
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
  if (!['1', '2', '3', '4', '5'].includes(Rank)) return 'Rank must be "1" through "5"'
  if (Title.length > 300) return 'Title must be 300 characters or fewer'
  if (Summary.length > 1000) return 'Summary must be 1000 characters or fewer'
  if (!/^https?:\/\//i.test(Link)) return 'Link must start with http:// or https://'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DateVal)) return 'Date must be in YYYY-MM-DD format'
  return null
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

  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Supabase config error'
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: msg }) }],
      isError: true,
    }
  }

  const today = new globalThis.Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ Rank, Topic, Title, Summary, Image: Image ?? null, Link, Date: DateVal ?? today })
    .select()
    .single()

  if (error) {
    return {
      content: [
        { type: 'text', text: JSON.stringify({ success: false, error: error.message }) },
      ],
      isError: true,
    }
  }

  return {
    content: [
      { type: 'text', text: JSON.stringify({ success: true, data }) },
    ],
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
    description: 'MCP server for Daily News Trigger — sends news items to Supabase',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  })
}
