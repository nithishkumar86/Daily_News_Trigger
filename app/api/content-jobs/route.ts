import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { createContentJob } from '@/lib/contentPipeline'

// The manager's Submit: saves the picked news as a pending content job. The
// Claude Code routine writes it on its next run; Codex then draws the images.
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let sb
  try {
    sb = getServerSupabase()
  } catch {
    return NextResponse.json({ error: 'Service not configured' }, { status: 500 })
  }

  try {
    const result = await createContentJob(sb, body)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result.data, { status: 201 })
  } catch (err) {
    console.error('content-jobs unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
