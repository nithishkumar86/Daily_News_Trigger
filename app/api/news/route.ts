import { NextResponse } from 'next/server'
import { getSupabase, TABLE_NAME } from '@/lib/supabase'

const ALLOWED_ORIGIN = 'https://daily-news-trigger.vercel.app'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabase()

    // CLAUDE.md Rule #4: never hardcode today's date — always use MAX(date)
    const { data: maxRow, error: maxErr } = await supabase
      .from(TABLE_NAME)
      .select('Date')
      .order('Date', { ascending: false })
      .limit(1)
      .single()

    // PGRST116 = 0 rows returned — table is empty, not an error condition
    if (!maxRow) {
      if (maxErr && maxErr.code !== 'PGRST116') {
        console.error('news/route MAX(date) error:', maxErr)
        return NextResponse.json(
          { success: false, error: 'Failed to fetch articles' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        )
      }
      return NextResponse.json(
        { success: true, data: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, Rank, Topic, Title, Summary, Image, Link, Date')
      .eq('Date', maxRow.Date)
      .order('Rank', { ascending: true })
      .limit(50)

    if (error) {
      console.error('news/route fetch error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch articles' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      { success: true, data: data ?? [] },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
    )
  } catch (err) {
    console.error('news/route unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch articles' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
