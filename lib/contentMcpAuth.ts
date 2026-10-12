import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

// Shared-secret gate for /api/content-mcp and /api/content-mcp/upload.
// claude.ai connectors can't send custom headers, so the key rides in the URL: ?key=<CONTENT_MCP_KEY>.
// Clients that can send headers (Codex / ChatGPT) may use Authorization: Bearer <CONTENT_MCP_KEY> instead.
// Fails closed: if the env var is missing every request is refused.
// (Only the content pipeline uses this — /api/webhook and /api/mcp stay open.)

const sameKey = (given: string, expected: string) => {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function checkContentMcpKey(req: Request): NextResponse | null {
  const expected = (process.env.CONTENT_MCP_KEY ?? '').trim()
  if (!expected) {
    return NextResponse.json({ success: false, error: 'server key not configured (CONTENT_MCP_KEY)' }, { status: 500 })
  }
  const queryKey = new URL(req.url).searchParams.get('key')
  const auth = req.headers.get('authorization') ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim() ?? ''

  if ((queryKey !== null && sameKey(queryKey, expected)) || (bearer && sameKey(bearer, expected))) return null

  // Shapes only, never key values: tells a dropped query key apart from a wrong one or an OAuth attempt
  console.warn('content-mcp 401', JSON.stringify({
    queryKey: queryKey === null ? 'absent' : `len ${queryKey.length}`,
    authHeader: auth ? (bearer ? `bearer len ${bearer.length}` : 'other scheme') : 'absent',
    userAgent: (req.headers.get('user-agent') ?? '').slice(0, 120),
  }))
  return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
}
