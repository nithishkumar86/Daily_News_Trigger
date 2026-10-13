'use client'
import { useMemo } from 'react'
import { TableName } from '@/lib/types'
import { AI_NEWS_TABLE } from '@/lib/supabase'
import { groupByDate } from '@/lib/newsFeed'
import { useNewsFeed } from '@/lib/useNewsFeed'
import NewsCard from '@/components/NewsCard'
import DateGroupHeader from '@/components/DateGroupHeader'

const TABLES: TableName[] = [AI_NEWS_TABLE]
const SKELETON_KEYS = [0, 1, 2, 3, 4, 5]

export default function LatestPage() {
  const { items, loading, error } = useNewsFeed({ tables: TABLES, topic: 'trending', channel: 'latest-ai-news' })
  const groups = useMemo(() => groupByDate(items), [items])
  const latestDate = items[0]?.Date ?? ''

  return (
    <div className="min-h-screen bg-[--bg-primary] pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">

        <div className="mb-6 sm:mb-8 pt-4">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[--text-primary]">Latest Trending</h1>
          <p className="text-[--text-muted] mt-1 text-sm sm:text-base">Most viral AI news, newest first</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {SKELETON_KEYS.map(i => (
              <div key={i} className="bg-[--bg-card] border border-[--border-subtle] rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-[--text-muted]">
            <div className="text-5xl sm:text-6xl mb-4">📰</div>
            <p className="text-base sm:text-lg font-medium">No trending news yet.</p>
            <p className="text-sm mt-2 text-center max-w-xs">Check back after 9 AM when the AI agent runs.</p>
          </div>
        ) : (
          <div className="space-y-10 max-w-5xl mx-auto">
            {groups.map(group => (
              <section key={group.date} className="space-y-4">
                <DateGroupHeader date={group.date} latestDate={latestDate} count={group.items.length} />
                <div className="flex flex-col gap-6">
                  {group.items.map(item => (
                    <NewsCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
