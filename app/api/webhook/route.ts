import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, TABLE_NAME } from '@/lib/supabase'
import type { WebhookPayload } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WebhookPayload
    const { Rank, Title, Summary, Link } = body

    if (!Rank || !Title || !Summary || !Link) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: Rank, Title, Summary, Link' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({ Rank, Title, Summary, Link })
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
  } catch (err) {
    console.error('[webhook] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
