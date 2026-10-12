'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase'
import { FeedItem, NewsItem, TableName } from '@/lib/types'
import { FEED_ROW_LIMIT, NEWS_COLUMNS, sortNewest, tagSource } from '@/lib/newsFeed'

interface UseNewsFeedOptions {
  tables: TableName[]
  topic?: string
  channel: string
}

// Loads ALL stored news (retention cleanup keeps it to 15 days) for the given tables,
// newest Date first then Rank, and live-reloads on any insert/update/delete.
export function useNewsFeed({ tables, topic, channel }: UseNewsFeedOptions) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seqRef = useRef(0)

  // Callers pass inline arrays — key on the joined string so effects don't re-run every render
  const tablesKey = tables.join(',')

  const load = useCallback(async () => {
    const seq = ++seqRef.current
    const supabase = getBrowserSupabase()
    const results = await Promise.all(
      (tablesKey.split(',') as TableName[]).map(async table => {
        let query = supabase.from(table).select(NEWS_COLUMNS)
        if (topic) query = query.eq('Topic', topic)
        const { data, error } = await query
          .order('Date', { ascending: false })
          .order('Rank', { ascending: true })
          .limit(FEED_ROW_LIMIT)
        return { table, rows: (data ?? []) as NewsItem[], error }
      })
    )
    // A newer load started while this one was in flight — drop the stale result
    if (seq !== seqRef.current) return

    const failed = results.filter(r => r.error)
    setError(failed.length ? `Could not load ${failed.map(r => r.table).join(', ')}` : null)
    setItems(sortNewest(results.flatMap(r => tagSource(r.rows, r.table))))
    setLoading(false)
  }, [tablesKey, topic])

  useEffect(() => {
    load()
    const supabase = getBrowserSupabase()
    // The ingest endpoint upserts rows one at a time — debounce so a batch triggers one reload
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleReload = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 800)
    }
    let ch = supabase.channel(channel)
    for (const table of tablesKey.split(',')) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleReload)
    }
    ch.subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(ch)
    }
  }, [load, channel, tablesKey])

  return { items, loading, error, reload: load }
}
