import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import {
  claimContentJob,
  claimImageJob,
  failContentJob,
  failImageJob,
  FORMAT_NAMES,
  getFormat,
  listPendingContentJobs,
  listPendingImageJobs,
  PipelineResult,
  submitContent,
  submitImageUrl,
} from '@/lib/contentPipeline'
import { checkContentMcpKey } from '@/lib/contentMcpAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

// MCP server for the content pipeline — used by the Claude Code routine (writer)
// and the Codex automation (images). Separate from /api/mcp so news ingest is untouched.
// Requires ?key=<CONTENT_MCP_KEY> on the URL (lib/contentMcpAuth.ts).

const SERVER_INFO = { name: 'content-pipeline', version: '1.0.0' }
const SUPPORTED_PROTOCOLS = ['2024-11-05', '2025-03-26', '2025-06-18']

const jobIdProp = { job_id: { type: 'string', description: 'The content job id (UUID) from list_pending_content_jobs' } }
const imageJobIdProp = { image_job_id: { type: 'string', description: 'The image job id (UUID) from list_pending_image_jobs' } }

const TOOLS = [
  {
    name: 'get_format',
    description: `Returns the instructions file for writing content. name: ${FORMAT_NAMES.join(', ')}. Follow it exactly.`,
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', enum: [...FORMAT_NAMES] } },
      required: ['name'],
    },
  },
  {
    name: 'list_pending_content_jobs',
    description: 'Lists newsletter/article jobs the manager submitted that still need writing (oldest first).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'claim_content_job',
    description:
      'Claims a pending job so no other run writes it. Returns kind ("newsletter" or "article") and items (the picked news). If it says already taken, skip the job.',
    inputSchema: { type: 'object', properties: jobIdProp, required: ['job_id'] },
  },
  {
    name: 'submit_content',
    description:
      'Saves the finished content and its image prompts for a claimed job. Newsletter: 4 image_prompts (section_key world, tools, insights, trending). Article: 1 image_prompt (section_key hero).',
    inputSchema: {
      type: 'object',
      properties: {
        ...jobIdProp,
        content: { type: 'string', description: 'The full newsletter/article text exactly as the manager should see it' },
        image_prompts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section_key: { type: 'string', enum: ['world', 'tools', 'insights', 'trending', 'hero'] },
              title: { type: 'string', description: 'Big headline of the image, e.g. TOP 5 AI TOOL UPDATES' },
              prompt: { type: 'string', description: 'Complete, self-contained image generation prompt' },
            },
            required: ['section_key', 'title', 'prompt'],
          },
        },
      },
      required: ['job_id', 'content', 'image_prompts'],
    },
  },
  {
    name: 'fail_content_job',
    description: 'Marks a claimed job as failed with a short reason, so the manager sees why.',
    inputSchema: {
      type: 'object',
      properties: { ...jobIdProp, error: { type: 'string', description: 'Short reason' } },
      required: ['job_id', 'error'],
    },
  },
  {
    name: 'list_pending_image_jobs',
    description: 'Lists image prompts that still need an image (oldest first).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'claim_image_job',
    description:
      'Claims an image job so no other run generates it. Returns the exact prompt to generate from. If it says already taken or already done, skip it.',
    inputSchema: { type: 'object', properties: imageJobIdProp, required: ['image_job_id'] },
  },
  {
    name: 'submit_image',
    description:
      'Attaches a finished image to a claimed image job from a public https URL. To send a local file instead, POST its bytes to /api/content-mcp/upload?id=<image_job_id>&key=<the same key as this server URL>.',
    inputSchema: {
      type: 'object',
      properties: { ...imageJobIdProp, image_url: { type: 'string', description: 'Public https URL of the PNG/JPEG/WebP image' } },
      required: ['image_job_id', 'image_url'],
    },
  },
  {
    name: 'fail_image_job',
    description: 'Marks a claimed image job as failed with a short reason.',
    inputSchema: {
      type: 'object',
      properties: { ...imageJobIdProp, error: { type: 'string', description: 'Short reason' } },
      required: ['image_job_id', 'error'],
    },
  },
]

type Args = Record<string, unknown>
const HANDLERS: Record<string, (sb: SupabaseClient, a: Args) => Promise<PipelineResult>> = {
  get_format: (_sb, a) => getFormat(a.name),
  list_pending_content_jobs: sb => listPendingContentJobs(sb),
  claim_content_job: (sb, a) => claimContentJob(sb, a.job_id),
  submit_content: (sb, a) => submitContent(sb, a.job_id, a.content, a.image_prompts),
  fail_content_job: (sb, a) => failContentJob(sb, a.job_id, a.error),
  list_pending_image_jobs: sb => listPendingImageJobs(sb),
  claim_image_job: (sb, a) => claimImageJob(sb, a.image_job_id),
  submit_image: (sb, a) => submitImageUrl(sb, a.image_job_id, a.image_url),
  fail_image_job: (sb, a) => failImageJob(sb, a.image_job_id, a.error),
}

// Image downloads (submit_image) can take a while
export const maxDuration = 30

const toolText = (payload: unknown, isError = false) => ({
  content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }],
  ...(isError ? { isError: true } : {}),
})

async function callTool(name: string, args: Args) {
  const handler = HANDLERS[name]
  if (!handler) return null
  let sb: SupabaseClient
  try {
    sb = getServerSupabase()
  } catch (err) {
    return toolText({ success: false, error: err instanceof Error ? err.message : 'Supabase config error' }, true)
  }
  try {
    const result = await handler(sb, args)
    if (!result.ok) return toolText({ success: false, error: result.error }, true)
    // get_format returns the raw markdown so the model reads it as instructions text
    if (name === 'get_format') return toolText((result.data as { content: string }).content)
    return toolText({ success: true, ...(result.data as object) })
  } catch (err) {
    console.error(`content-mcp ${name} error:`, err)
    return toolText({ success: false, error: 'Internal error' }, true)
  }
}

export async function POST(req: NextRequest) {
  const denied = checkContentMcpKey(req)
  if (denied) return denied

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 })
  }
  const { id = null, method, params } = body ?? {}

  if (method === 'initialize') {
    // Answer with the client's version when we speak it (stateless JSON responses fit all three)
    const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : ''
    const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0]
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: { protocolVersion, serverInfo: SERVER_INFO, capabilities: { tools: {} } },
    })
  }
  // Notifications get no JSON-RPC response — just acknowledge receipt
  if (typeof method === 'string' && method.startsWith('notifications/')) return new NextResponse(null, { status: 202 })
  if (method === 'ping') return NextResponse.json({ jsonrpc: '2.0', id, result: {} })
  if (method === 'tools/list') return NextResponse.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } })

  if (method === 'tools/call') {
    const name = typeof params?.name === 'string' ? params.name : ''
    const rawArgs = params?.arguments
    const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? (rawArgs as Args) : {}
    const result = await callTool(name, args)
    if (!result) return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } })
    return NextResponse.json({ jsonrpc: '2.0', id, result })
  }

  return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
}

// Streamable HTTP: a server that offers no server-to-client SSE stream must answer GET with 405
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
