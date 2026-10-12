import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

// Shared-secret gate for /api/content-mcp and /api/content-mcp/upload.
// claude.ai connectors can't send custom headers, so the key rides in the URL: ?key=<CONTENT_MCP_KEY>.
// Fails closed: if the env var is missing every request is refused.
// (Only the content pipeline uses this — /api/webhook and /api/mcp stay open.)

export function checkContentMcpKey(req: Request): NextResponse | null {
  const expected = (process.env.CONTENT_MCP_KEY ?? '').trim()
  if (!expected) {
    return NextResponse.json({ success: false, error: 'server key not configured (CONTENT_MCP_KEY)' }, { status: 500 })
  }
  const given = new URL(req.url).searchParams.get('key') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
  return null
}
