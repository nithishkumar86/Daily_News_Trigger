import { NextResponse } from 'next/server'
import { getSupabase, TABLE_NAME } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = getSupabase()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('Date', today)
      .order('Rank', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=10' } }
    )
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch articles' },
      { status: 500 }
    )
  }
}
