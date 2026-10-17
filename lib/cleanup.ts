import {
  getServerSupabase,
  AI_NEWS_TABLE,
  INVESTMENT_NEWS_TABLE,
  JOB_NEWS_TABLE,
  REAL_ESTATE_NEWS_TABLE,
  CLEANUP_LOG_TABLE,
  IMAGE_BUCKET,
} from './supabase'
import { CONTENT_JOBS_TABLE, IMAGE_JOBS_TABLE } from './contentPipeline'
import { retentionCutoff, contentRetentionCutoff } from './retention'
import type { SupabaseClient } from '@supabase/supabase-js'

// Delete image files older than the cutoff from one bucket folder.
// Filenames are `${date}-rank${rank}.${ext}` (e.g. 2026-06-30-rank1.jpg),
// so the date is the first 10 chars — same retention cutoff as the DB rows.
async function cleanupBucketFolder(
  supabase: SupabaseClient,
  folder: string,
  cutoff: string
): Promise<number> {
  const { data: files, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .list(folder, { limit: 1000 })
  if (error || !files) return 0

  const toDelete = files
    .filter(f => {
      const date = f.name.slice(0, 10)
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < cutoff
    })
    .map(f => `${folder}/${f.name}`)

  if (toDelete.length === 0) return 0
  const { error: rmErr } = await supabase.storage.from(IMAGE_BUCKET).remove(toDelete)
  return rmErr ? 0 : toDelete.length
}

// Removes finished generated drafts (content_jobs) older than the content
// cutoff, plus their image_jobs rows and uploaded images. Only 'written' and
// 'failed' jobs qualify — 'pending'/'writing'/'generating' are still in
// flight and must never be purged regardless of age.
async function cleanupContentJobs(
  supabase: SupabaseClient,
  cutoffIso: string
): Promise<{ deletedJobs: number; deletedImages: number; errors: string[] }> {
  const errors: string[] = []

  const { data: jobs, error: selErr } = await supabase
    .from(CONTENT_JOBS_TABLE)
    .select('id')
    .in('status', ['written', 'failed'])
    .lt('created_at', cutoffIso)
  if (selErr) {
    errors.push(`${CONTENT_JOBS_TABLE} select: ${selErr.message}`)
    return { deletedJobs: 0, deletedImages: 0, errors }
  }
  const jobIds = (jobs ?? []).map(j => j.id as string)
  if (jobIds.length === 0) return { deletedJobs: 0, deletedImages: 0, errors }

  // Storage first — an orphaned file costs space, an orphaned row does not.
  let deletedImages = 0
  for (const jobId of jobIds) {
    try {
      const { data: files } = await supabase.storage.from(IMAGE_BUCKET).list(`generated/${jobId}`, { limit: 1000 })
      if (files && files.length > 0) {
        const paths = files.map(f => `generated/${jobId}/${f.name}`)
        const { error: rmErr } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
        if (!rmErr) deletedImages += paths.length
      }
    } catch {
      // best-effort — a storage hiccup never blocks the DB cleanup
    }
  }

  const { count: imgCount, error: imgErr } = await supabase
    .from(IMAGE_JOBS_TABLE)
    .delete({ count: 'exact' })
    .in('job_id', jobIds)
  if (imgErr) errors.push(`${IMAGE_JOBS_TABLE}: ${imgErr.message}`)

  const { count: jobCount, error: jobErr } = await supabase
    .from(CONTENT_JOBS_TABLE)
    .delete({ count: 'exact' })
    .in('id', jobIds)
  if (jobErr) errors.push(`${CONTENT_JOBS_TABLE}: ${jobErr.message}`)

  return { deletedJobs: jobCount ?? 0, deletedImages, errors }
}

export interface CleanupResult {
  success: boolean
  deleted_ai: number
  deleted_investment: number
  deleted_job: number
  deleted_real_estate: number
  deleted_images: number
  deleted_content_jobs: number
  deleted_content_images: number
  errors: string[]
}

export async function runCleanup(): Promise<CleanupResult> {
  const supabase = getServerSupabase()
  // Rolling window: rows dated before the cutoff fall outside the last
  // RETENTION_DAYS calendar dates and are removed.
  const cutoff = retentionCutoff(Date.now())
  const errors: string[] = []

  // Column is quoted "Date" in Postgres (case-sensitive) — an unquoted `date`
  // filter is folded to lowercase by Postgres and fails with 42703.
  const { count: aiCount, error: aiErr } = await supabase
    .from(AI_NEWS_TABLE)
    .delete({ count: 'exact' })
    .lt('Date', cutoff)
  if (aiErr) {
    console.error('cleanup ai_news delete failed:', aiErr)
    errors.push(`${AI_NEWS_TABLE}: ${aiErr.message}`)
  }

  const { count: invCount, error: invErr } = await supabase
    .from(INVESTMENT_NEWS_TABLE)
    .delete({ count: 'exact' })
    .lt('Date', cutoff)
  if (invErr) {
    console.error('cleanup investment_news delete failed:', invErr)
    errors.push(`${INVESTMENT_NEWS_TABLE}: ${invErr.message}`)
  }

  const { count: jobCount, error: jobErr } = await supabase
    .from(JOB_NEWS_TABLE)
    .delete({ count: 'exact' })
    .lt('Date', cutoff)
  if (jobErr) {
    console.error('cleanup job_hire_fire delete failed:', jobErr)
    errors.push(`${JOB_NEWS_TABLE}: ${jobErr.message}`)
  }

  const { count: realEstateCount, error: realEstateErr } = await supabase
    .from(REAL_ESTATE_NEWS_TABLE)
    .delete({ count: 'exact' })
    .lt('Date', cutoff)
  if (realEstateErr) {
    console.error('cleanup real_estate_news delete failed:', realEstateErr)
    errors.push(`${REAL_ESTATE_NEWS_TABLE}: ${realEstateErr.message}`)
  }

  // Mirror the DB cleanup in Storage: remove cover images dated before the cutoff.
  // Wrapped so a storage hiccup never blocks the DB cleanup / log update.
  let deletedImages = 0
  try {
    deletedImages += await cleanupBucketFolder(supabase, AI_NEWS_TABLE, cutoff)
    deletedImages += await cleanupBucketFolder(supabase, INVESTMENT_NEWS_TABLE, cutoff)
    deletedImages += await cleanupBucketFolder(supabase, JOB_NEWS_TABLE, cutoff)
    deletedImages += await cleanupBucketFolder(supabase, REAL_ESTATE_NEWS_TABLE, cutoff)
  } catch {
    // ignore — image cleanup is best-effort
  }

  // Finished newsletter/article drafts get a longer, separate retention window.
  let deletedContentJobs = 0
  let deletedContentImages = 0
  try {
    const contentCutoff = contentRetentionCutoff(Date.now())
    const result = await cleanupContentJobs(supabase, contentCutoff)
    deletedContentJobs = result.deletedJobs
    deletedContentImages = result.deletedImages
    errors.push(...result.errors)
  } catch (err) {
    errors.push(`${CONTENT_JOBS_TABLE}: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  // Only record success when every delete actually succeeded. Stamping
  // `last_cleaned` after a failed delete marks the job done while nothing was
  // removed, which silently suppresses retries until the next interval. Leaving
  // the log untouched makes the next request retry.
  const success = errors.length === 0
  if (success) {
    const today = new Date().toISOString().split('T')[0]
    const { error: logErr } = await supabase
      .from(CLEANUP_LOG_TABLE)
      .upsert({ id: 1, last_cleaned: today }, { onConflict: 'id' })
    if (logErr) {
      console.error('cleanup_log upsert failed:', logErr)
      errors.push(`${CLEANUP_LOG_TABLE}: ${logErr.message}`)
    }
  }

  return {
    success: errors.length === 0,
    deleted_ai: aiCount ?? 0,
    deleted_investment: invCount ?? 0,
    deleted_job: jobCount ?? 0,
    deleted_real_estate: realEstateCount ?? 0,
    deleted_images: deletedImages,
    deleted_content_jobs: deletedContentJobs,
    deleted_content_images: deletedContentImages,
    errors,
  }
}
