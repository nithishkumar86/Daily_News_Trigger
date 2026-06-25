import { NextResponse } from 'next/server'
import { getSupabase, TABLE_NAME } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[news] Supabase fetch error:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[news] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch articles' }, { status: 500 })
  }
}
