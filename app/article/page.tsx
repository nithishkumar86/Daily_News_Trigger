'use client'
import { useCallback, useMemo } from 'react'
import { TableName } from '@/lib/types'
import { AI_NEWS_TABLE } from '@/lib/supabase'
import { groupByDate } from '@/lib/newsFeed'
import { useNewsFeed } from '@/lib/useNewsFeed'
import { useSelection } from '@/lib/useSelection'
import { useSubmitJob } from '@/lib/useSubmitJob'
import NewsCard from '@/components/NewsCard'
import DateGroupHeader from '@/components/DateGroupHeader'
import ContentGeneratorPanel from '@/components/ContentGeneratorPanel'
import SubmittedBanner from '@/components/SubmittedBanner'

const TABLES: TableName[] = [AI_NEWS_TABLE]
const MAX_ITEMS = 20
const SKELETON_KEYS = [0, 1, 2]

export default function ArticlePage() {
  // Article tab shows only AI tool news
  const { items, loading, error } = useNewsFeed({ tables: TABLES, topic: 'tools', channel: 'article-feed' })
  const selection = useSelection(items, MAX_ITEMS)
  const job = useSubmitJob()

  // Queue the selection for the morning run; on success start a fresh selection
  const { selected, clear } = selection
  const handleSubmit = useCallback(async () => {
    if (await job.submit('article', selected)) clear()
  }, [job, selected, clear])

  const groups = useMemo(() => groupByDate(items), [items])
  const latestDate = items[0]?.Date ?? ''

  return (
    <div className="min-h-screen bg-[--bg-primary] pb-32 sm:pb-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        <div className="mb-6 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[--text-primary]">Article</h1>
            <p className="text-[--text-muted] mt-1 text-sm sm:text-base">
              AI tools news — select tools and submit an article (best with 1–3). It is written and illustrated on the next morning run.
            </p>
          </div>
          {!loading && items.length > 0 && (
            <span className="self-start sm:self-auto inline-flex items-center px-3 py-1 rounded-full bg-[--bg-elevated] border border-[--border-subtle] text-[--text-muted] text-xs font-medium">
              {items.length} {items.length === 1 ? 'tool' : 'tools'}
            </span>
          )}
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {selection.atLimit && <p className="mb-4 text-sm text-amber-400">Maximum {MAX_ITEMS} stories selected</p>}

        {loading ? (
          <div className="flex flex-col gap-6">
            {SKELETON_KEYS.map(i => (
              <div key={i} className="bg-[--bg-card] border border-[--border-subtle] rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[--text-muted] text-center">
            <div className="text-5xl mb-4" aria-hidden="true">🛠️</div>
            <p className="text-lg font-medium text-[--text-primary]">No AI tools news yet.</p>
            <p className="text-sm mt-2">Tools stories appear here as soon as the AI agent publishes them.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map(group => (
              <section key={group.date} className="space-y-4">
                <DateGroupHeader date={group.date} latestDate={latestDate} count={group.items.length} />
                <div className="flex flex-col gap-6">
                  {group.items.map(item => (
                    <NewsCard
                      key={item.id}
                      item={item}
                      checked={selection.ids.has(item.id)}
                      onToggle={selection.toggle}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <ContentGeneratorPanel
        selectedCount={job.error ? 0 : selection.selected.length}
        format="article"
        maxItems={MAX_ITEMS}
        onGenerate={handleSubmit}
        onClear={selection.clear}
        isGenerating={job.isSubmitting}
        actionLabel="Submit Article →"
        busyLabel="Submitting..."
      />

      {/* Shares the bottom slot with the Submit bar: success shows once the selection resets, an error replaces the bar until dismissed */}
      {(job.error || selection.selected.length === 0) && (
        <SubmittedBanner kind="article" submittedId={job.submittedId} error={job.error} onDismiss={job.dismiss} />
      )}
    </div>
  )
}
