import { NextResponse } from 'next/server'
import { getServerSupabase, CLEANUP_LOG_TABLE } from '@/lib/supabase'
import { runCleanup } from '@/lib/cleanup'

const CLEANUP_INTERVAL_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Parse a YYYY-MM-DD calendar date to UTC midnight. Returns null for anything
// that is not a well-formed date string, so a corrupt log row reads as "never
// cleaned" and the cleanup runs rather than being skipped forever.
function parseCalendarDate(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const ms = Date.parse(`${value}T00:00:00Z`)
  return Number.isNaN(ms) ? null : ms
}

function toDateString(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]
}

export async function GET() {
  try {
    // Today derived at request time — never hardcoded.
    const todayMs = parseCalendarDate(new Date().toISOString().split('T')[0])
    if (todayMs === null) {
      return NextResponse.json({ error: 'Unable to resolve current date' }, { status: 500 })
    }

    const supabase = getServerSupabase()
    const { data: log } = await supabase
      .from(CLEANUP_LOG_TABLE)
      .select('last_cleaned')
      .eq('id', 1)
      .single()

    const lastCleanedMs = parseCalendarDate(log?.last_cleaned)

    // Never cleaned (or unreadable) → due immediately. Otherwise due once the
    // calendar-day gap reaches the interval. Replaces the old Sunday-only gate,
    // which never fired unless a human happened to load the site on a UTC
    // Sunday and then waited another full week.
    if (lastCleanedMs !== null) {
      const daysSince = Math.floor((todayMs - lastCleanedMs) / MS_PER_DAY)
      if (daysSince < CLEANUP_INTERVAL_DAYS) {
        return NextResponse.json({
          cleaned: false,
          message: 'Not due',
          last_cleaned: toDateString(lastCleanedMs),
          next_due: toDateString(lastCleanedMs + CLEANUP_INTERVAL_DAYS * MS_PER_DAY),
        })
      }
    }

    // Concurrency: two simultaneous requests can both read "due" and both call
    // runCleanup(). This is accepted, not overlooked — every delete is
    // `.lt('Date', cutoff)`, so a second concurrent pass removes the same
    // already-gone rows and is a no-op. No lock is taken by design.
    const result = await runCleanup()
    return NextResponse.json({ cleaned: true, result }, { status: result.success ? 200 : 500 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
