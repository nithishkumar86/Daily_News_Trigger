import {
  getServerSupabase,
  AI_NEWS_TABLE,
  INVESTMENT_NEWS_TABLE,
  CLEANUP_LOG_TABLE,
  IMAGE_BUCKET,
} from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// Delete image files older than the cutoff from one bucket folder.
// Filenames are `${date}-rank${rank}.${ext}` (e.g. 2026-06-30-rank1.jpg),
// so the date is the first 10 chars — same 7-day cutoff as the DB rows.
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

export async function runCleanup(): Promise<{
  deleted_ai: number
  deleted_investment: number
  deleted_images: number
}> {
  const supabase = getServerSupabase()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { count: aiCount } = await supabase
    .from(AI_NEWS_TABLE)
    .delete({ count: 'exact' })
    .lt('date', sevenDaysAgo)

  const { count: invCount } = await supabase
    .from(INVESTMENT_NEWS_TABLE)
    .delete({ count: 'exact' })
    .lt('date', sevenDaysAgo)

  // Mirror the DB cleanup in Storage: remove cover images older than 7 days.
  // Wrapped so a storage hiccup never blocks the DB cleanup / log update.
  let deletedImages = 0
  try {
    deletedImages += await cleanupBucketFolder(supabase, AI_NEWS_TABLE, sevenDaysAgo)
    deletedImages += await cleanupBucketFolder(supabase, INVESTMENT_NEWS_TABLE, sevenDaysAgo)
  } catch {
    // ignore — image cleanup is best-effort
  }

  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from(CLEANUP_LOG_TABLE)
    .upsert({ id: 1, last_cleaned: today }, { onConflict: 'id' })

  return { deleted_ai: aiCount ?? 0, deleted_investment: invCount ?? 0, deleted_images: deletedImages }
}
