// Rolling news retention window. Pure and Supabase-free so it is safe to import
// from both server routes and client components.

export const RETENTION_DAYS = 15

// Generated newsletter/article drafts (content_jobs/image_jobs) are small
// text + storage-path rows, not the base64 blobs the news tables hold, so
// they can afford a longer window before they start costing free-tier space.
export const CONTENT_RETENTION_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Oldest calendar date (YYYY-MM-DD, UTC) that is still kept. Deleting rows with
// `.lt('Date', cutoff)` therefore keeps exactly RETENTION_DAYS calendar dates:
// today plus the RETENTION_DAYS − 1 days before it.
export function retentionCutoff(nowMs: number): string {
  if (!Number.isFinite(nowMs)) {
    throw new RangeError('retentionCutoff: nowMs must be a finite timestamp')
  }
  return new Date(nowMs - (RETENTION_DAYS - 1) * MS_PER_DAY).toISOString().slice(0, 10)
}

// Oldest `created_at` timestamp (ISO) still kept for content_jobs/image_jobs.
// Unlike retentionCutoff, this filters a timestamp column, not a calendar date.
export function contentRetentionCutoff(nowMs: number): string {
  if (!Number.isFinite(nowMs)) {
    throw new RangeError('contentRetentionCutoff: nowMs must be a finite timestamp')
  }
  return new Date(nowMs - CONTENT_RETENTION_DAYS * MS_PER_DAY).toISOString()
}
