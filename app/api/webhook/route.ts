import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, TABLE_NAME } from '@/lib/supabase'
import type { WebhookPayload } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WebhookPayload
    const { rank, title, summary, link } = body

    if (rank === undefined || !title || !summary || !link) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: rank, title, summary, link' },
        { status: 400 }
      )
    }

    if (typeof rank !== 'number') {
      return NextResponse.json(
        { success: false, error: 'rank must be a number' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({ Rank: rank, Title: title, Summary: summary, Link: link })
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
