import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { WebhookBody } from '@/lib/types'

const AI_TOPICS = ['trending', 'ai', 'tools', 'models']
const INVESTMENT_TOPICS = ['startup', 'investment', 'funding', 'company']
const ALL_VALID_TOPICS = [...AI_TOPICS, ...INVESTMENT_TOPICS]

function resolveTable(topic: string): 'ai_news' | 'investment_news' | null {
  const t = topic.toLowerCase().trim()
  if (AI_TOPICS.includes(t)) return 'ai_news'
  if (INVESTMENT_TOPICS.includes(t)) return 'investment_news'
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body: WebhookBody = await req.json()
    const { items } = body

    if (!items || !Array.isArray(items) || items.length < 5) {
      return NextResponse.json(
        { success: false, error: 'items must be an array with minimum 5 news items' },
        { status: 400 }
      )
    }

    if (items.length > 10) {
      return NextResponse.json(
        { success: false, error: 'items must not exceed 10 news items' },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().split('T')[0]
    const supabase = getServerSupabase()

    // Validate all items before inserting any
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.Topic) {
        return NextResponse.json({ success: false, error: `Item ${i + 1}: Topic is required` }, { status: 400 })
      }
      const table = resolveTable(item.Topic)
      if (!table) {
        return NextResponse.json(
          { success: false, error: `Item ${i + 1}: Topic "${item.Topic}" is invalid. Must be one of: ${ALL_VALID_TOPICS.join(', ')}` },
          { status: 400 }
        )
      }
      if (!item.Rank || item.Rank < 1 || item.Rank > 10) {
        return NextResponse.json({ success: false, error: `Item ${i + 1}: Rank must be between 1 and 10` }, { status: 400 })
      }
      if (!item.Title) {
        return NextResponse.json({ success: false, error: `Item ${i + 1}: Title is required` }, { status: 400 })
      }
      const titleWords = item.Title.trim().split(/\s+/).length
      if (titleWords >= 20) {
        return NextResponse.json({ success: false, error: `Item ${i + 1}: Title must be under 20 words (current: ${titleWords} words)` }, { status: 400 })
      }
      if (!item.Summary || item.Summary.length < 500) {
        return NextResponse.json({ success: false, error: `Item ${i + 1}: Summary must be at least 500 characters` }, { status: 400 })
      }
      if (!item.Link) {
        return NextResponse.json({ success: false, error: `Item ${i + 1}: Link is required` }, { status: 400 })
      }
    }

    // Group items by target table based on Topic
    const aiRows: object[] = []
    const investmentRows: object[] = []

    for (const item of items) {
      const row = {
        Rank: item.Rank,
        Topic: item.Topic.toLowerCase().trim(),
        Title: item.Title,
        Summary: item.Summary,
        Image: item.Image ?? null,
        Link: item.Link,
        Date: item.Date ?? today,
      }
      if (resolveTable(item.Topic) === 'ai_news') {
        aiRows.push(row)
      } else {
        investmentRows.push(row)
      }
    }

    const results: { table: string; inserted: number }[] = []

    if (aiRows.length > 0) {
      const { data, error } = await supabase
        .from('ai_news')
        .upsert(aiRows, { onConflict: 'Date,Rank' })
        .select()
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      results.push({ table: 'ai_news', inserted: data?.length ?? 0 })
    }

    if (investmentRows.length > 0) {
      const { data, error } = await supabase
        .from('investment_news')
        .upsert(investmentRows, { onConflict: 'Date,Rank' })
        .select()
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      results.push({ table: 'investment_news', inserted: data?.length ?? 0 })
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
