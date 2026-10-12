import { retentionCutoff, RETENTION_DAYS } from '@/lib/retention'

// Calendar date N days before `nowMs`, built independently of retentionCutoff
// (via setUTCDate) so the boundary assertions are not tautological.
function utcDaysBefore(nowMs: number, days: number): string {
  const d = new Date(nowMs)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

describe('retentionCutoff', () => {
  const nowMs = Date.now()

  it('happy path: keeps today−14 and deletes today−15 under a `.lt` filter', () => {
    const cutoff = retentionCutoff(nowMs)

    expect(RETENTION_DAYS).toBe(15)
    expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(cutoff).toBe(utcDaysBefore(nowMs, RETENTION_DAYS - 1))
    // Kept: not strictly less than the cutoff.
    expect(utcDaysBefore(nowMs, 0) < cutoff).toBe(false)
    expect(utcDaysBefore(nowMs, 14) < cutoff).toBe(false)
    // Deleted: strictly less than the cutoff.
    expect(utcDaysBefore(nowMs, 15) < cutoff).toBe(true)
  })

  it('edge case: same cutoff for the first and last millisecond of a UTC day', () => {
    const dayStart = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`)
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1

    expect(retentionCutoff(dayStart)).toBe(retentionCutoff(dayEnd))
    expect(retentionCutoff(dayEnd + 1)).toBe(utcDaysBefore(dayEnd + 1, RETENTION_DAYS - 1))
    expect(retentionCutoff(dayEnd + 1)).not.toBe(retentionCutoff(dayEnd))
  })

  it('error case: throws a RangeError for a non-finite timestamp', () => {
    expect(() => retentionCutoff(NaN)).toThrow(RangeError)
    expect(() => retentionCutoff(Infinity)).toThrow(/finite timestamp/)
  })
})
