import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase, IMAGE_BUCKET } from '@/lib/supabase'
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

    function extFromMime(mime: string): string {
      if (mime.includes('png')) return 'png'
      if (mime.includes('webp')) return 'webp'
      if (mime.includes('gif')) return 'gif'
      return 'jpg'
    }

    // Resolve images: download the agent's temporary URL and upload it to
    // Supabase Storage, storing only the permanent public URL. A `data:` /
    // raw base64 value (or nothing) is passed through unchanged.
    async function resolveImage(
      table: 'ai_news' | 'investment_news',
      date: string,
      rank: number,
      image?: string,
      imageUrl?: string
    ): Promise<string | null> {
      const url = imageUrl ?? (image?.startsWith('http') ? image : null)
      if (!url) return image ?? null
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const buffer = Buffer.from(await res.arrayBuffer())
        const mime = res.headers.get('content-type') ?? 'image/jpeg'
        const path = `${table}/${date}-rank${rank}.${extFromMime(mime)}`
        const { error: uploadErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, buffer, { contentType: mime, upsert: true })
        if (uploadErr) return null
        return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
      } catch {
        return null
      }
    }

    // Resolve all images in parallel (avoids slow sequential webhook latency)
    const resolvedImages = await Promise.all(
      items.map(item => {
        const table = resolveTable(item.Topic)! // validated above
        return resolveImage(table, item.Date ?? today, item.Rank, item.Image, item.ImageUrl)
      })
    )

    // Group items by target table based on Topic
    const aiRows: object[] = []
    const investmentRows: object[] = []

    items.forEach((item, i) => {
      const row = {
        Rank: item.Rank,
        Topic: item.Topic.toLowerCase().trim(),
        Title: item.Title,
        Summary: item.Summary,
        Image: resolvedImages[i],
        Link: item.Link,
        Date: item.Date ?? today,
      }
      if (resolveTable(item.Topic) === 'ai_news') {
        aiRows.push(row)
      } else {
        investmentRows.push(row)
      }
    })

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
