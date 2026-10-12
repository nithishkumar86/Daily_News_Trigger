import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { isUuid, MAX_IMAGE_BYTES, storeImage } from '@/lib/contentPipeline'
import { checkContentMcpKey } from '@/lib/contentMcpAuth'

// Raw image upload for the Codex automation: an agent can't type megabytes of
// base64 into a tool call, so it POSTs the file bytes here instead:
//   curl -X POST ".../api/content-mcp/upload?id=<image_job_id>&key=<CONTENT_MCP_KEY>" -H "Content-Type: image/png" --data-binary @image.png
// The image job must already be claimed (status generating); done images are never replaced.

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const denied = checkContentMcpKey(req)
  if (denied) return denied

  const id = req.nextUrl.searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'id must be an image job UUID' }, { status: 400 })

  // Reject oversized bodies before reading them
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_IMAGE_BYTES) {
    return NextResponse.json({ success: false, error: `image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB)` }, { status: 413 })
  }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await req.arrayBuffer())
  } catch {
    return NextResponse.json({ success: false, error: 'could not read the request body' }, { status: 400 })
  }

  let sb
  try {
    sb = getServerSupabase()
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Supabase config error' }, { status: 500 })
  }

  try {
    const result = await storeImage(sb, id, bytes)
    if (!result.ok) {
      const status = /not found/.test(result.error) ? 404 : /claim it first/.test(result.error) ? 409 : /too large/.test(result.error) ? 413 : 400
      return NextResponse.json({ success: false, error: result.error }, { status })
    }
    return NextResponse.json({ success: true, ...result.data })
  } catch (err) {
    console.error('content-mcp upload error:', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
