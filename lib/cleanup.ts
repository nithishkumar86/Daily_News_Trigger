import { getServerSupabase, AI_NEWS_TABLE, INVESTMENT_NEWS_TABLE, CLEANUP_LOG_TABLE } from './supabase'

export async function runCleanup(): Promise<{ deleted_ai: number; deleted_investment: number }> {
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

  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from(CLEANUP_LOG_TABLE)
    .upsert({ id: 1, last_cleaned: today }, { onConflict: 'id' })

  return { deleted_ai: aiCount ?? 0, deleted_investment: invCount ?? 0 }
}
