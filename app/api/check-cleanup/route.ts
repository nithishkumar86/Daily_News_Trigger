import { NextResponse } from 'next/server'
import { getServerSupabase, CLEANUP_LOG_TABLE } from '@/lib/supabase'
import { runCleanup } from '@/lib/cleanup'

export async function GET() {
  try {
    const today = new Date()
    if (today.getDay() !== 0) {
      return NextResponse.json({ cleaned: false, message: 'Not Sunday' })
    }

    const todayStr = today.toISOString().split('T')[0]
    const supabase = getServerSupabase()

    const { data: log } = await supabase
      .from(CLEANUP_LOG_TABLE)
      .select('last_cleaned')
      .eq('id', 1)
      .single()

    if (log?.last_cleaned === todayStr) {
      return NextResponse.json({ cleaned: false, message: 'Already cleaned today' })
    }

    const result = await runCleanup()
    return NextResponse.json({ cleaned: true, result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
