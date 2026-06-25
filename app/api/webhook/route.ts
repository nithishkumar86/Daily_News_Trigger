import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, TABLE_NAME } from '@/lib/supabase'
import type { WebhookPayload } from '@/lib/types'

export async function POST(req: NextRequest) {
  let body: WebhookPayload
  try {
    body = (await req.json()) as WebhookPayload
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { Rank, Title, Summary, Link, Date } = body

  if (!Rank || !Title || !Summary || !Link) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: Rank, Title, Summary, Link' },
      { status: 400 }
    )
  }

  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Supabase config error'
    console.error('[webhook] Supabase config error:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ Rank, Title, Summary, Link, Date: Date ?? new globalThis.Date().toISOString().split('T')[0] })
    .select()
    .single()

  if (error) {
    console.error('[webhook] Supabase insert error:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
