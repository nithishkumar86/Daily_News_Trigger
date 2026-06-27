import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { WebhookBody } from '@/lib/types'

const ALLOWED_TABLES = ['ai_news', 'investment_news'] as const

export async function POST(req: NextRequest) {
  try {
    const body: WebhookBody = await req.json()
    const { table, items } = body

    if (!table || !ALLOWED_TABLES.includes(table as (typeof ALLOWED_TABLES)[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid table. Must be one of: ${ALLOWED_TABLES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items must be a non-empty array' },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().split('T')[0]
    const supabase = getServerSupabase()

    const rows = items.map(item => ({
      Rank: item.Rank,
      Topic: item.Topic,
      Title: item.Title,
      Summary: item.Summary,
      Image: item.Image ?? null,
      Link: item.Link,
      Date: item.Date ?? today,
    }))

    const { data, error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: 'Date,Rank' })
      .select()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, table, inserted: data?.length ?? 0 })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
