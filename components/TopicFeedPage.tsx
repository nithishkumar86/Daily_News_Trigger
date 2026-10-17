'use client'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Search, X } from 'lucide-react'
import { TableName } from '@/lib/types'
import { groupByDate, matchesQuery } from '@/lib/newsFeed'
import { useNewsFeed } from '@/lib/useNewsFeed'
import { useSelection } from '@/lib/useSelection'
import { useContentGeneration } from '@/lib/useContentGeneration'
import NewsCard from '@/components/NewsCard'
import DateGroupHeader from '@/components/DateGroupHeader'
import ContentGeneratorPanel from '@/components/ContentGeneratorPanel'

const ContentModal = dynamic(() => import('@/components/ContentModal'), { ssr: false })

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5]
const MAX_ITEMS = 20

interface TopicFeedPageProps {
  table: TableName
  channel: string
  fixedTopics: string[]
  accent: string
  title: string
  subtitle: string
  emptyIcon: string
  emptyLabel: string
  countNoun: [singular: string, plural: string]
  // Quick-search chips shown under the search box (e.g. Claude / ChatGPT / Gemini on AI)
  searchSuggestions?: string[]
}

// News feed for one table (AI / Invest / Jobs / Real Estate): all stored days newest first,
// a search box + topic filter pills (both scoped to this table), and LinkedIn post generation only.
export default function TopicFeedPage({
  table, channel, fixedTopics, accent, title, subtitle, emptyIcon, emptyLabel, countNoun, searchSuggestions,
}: TopicFeedPageProps) {
  const tables = useMemo(() => [table], [table])
  const { items, loading, error } = useNewsFeed({ tables, channel })
  const selection = useSelection(items, MAX_ITEMS)
  const gen = useContentGeneration()
  const [activeTab, setActiveTab] = useState('all')
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''

  const topics = useMemo(() => {
    const dbTopics = Array.from(new Set(items.map(i => (i.Topic ?? '').trim().toLowerCase().slice(0, 50))))
    return [...fixedTopics, ...dbTopics.filter(t => t && !fixedTopics.includes(t))]
  }, [items, fixedTopics])

  // Search and topic pill combine (AND); order is kept so groupByDate stays newest-first
  const filtered = useMemo(
    () => items.filter(i =>
      (activeTab === 'all' || (i.Topic ?? '').trim().toLowerCase() === activeTab) && matchesQuery(i, query)
    ),
    [items, activeTab, query]
  )
  const groups = useMemo(() => groupByDate(filtered), [filtered])
  const latestDate = items[0]?.Date ?? ''
  const hasItems = !loading && items.length > 0

  const tabClass = (active: boolean) =>
    `min-h-[44px] py-2 px-5 rounded-full text-base font-medium transition-all whitespace-nowrap ${
      active ? 'text-white' : 'bg-[--bg-elevated] text-[--text-muted] hover:bg-[--border-subtle]'
    }`
  const tabStyle = (active: boolean) => (active ? { backgroundColor: accent } : undefined)

  return (
    <div className="min-h-screen bg-[--bg-primary] pb-32 sm:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">

        <div className="mb-6 sm:mb-8 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[--text-primary]">{title}</h1>
            <p className="text-[--text-muted] mt-1 text-sm sm:text-base">{subtitle}</p>
          </div>
          {hasItems && (
            <span className="self-start sm:self-auto inline-flex items-center px-3 py-1 rounded-full bg-[--bg-elevated] border border-[--border-subtle] text-[--text-muted] text-xs font-medium">
              {filtered.length} {filtered.length === 1 ? countNoun[0] : countNoun[1]}
            </span>
          )}
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {hasItems && (
          <>
            <div className="mb-4 max-w-xl">
              <div className="relative">
                <Search size={18} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
                  placeholder={`Search ${emptyLabel}…`}
                  aria-label={`Search ${emptyLabel}`}
                  maxLength={100}
                  className="w-full min-h-[44px] pl-11 pr-11 rounded-full bg-[--bg-elevated] border border-[--border-subtle] text-base text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 [&::-webkit-search-cancel-button]:hidden"
                  style={{ '--tw-ring-color': accent } as React.CSSProperties}
                  data-testid="news-search"
                />
                {searching && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-[--text-muted] hover:text-[--text-primary]"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
              {searchSuggestions && searchSuggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {searchSuggestions.map(s => {
                    const active = query.trim().toLowerCase() === s.toLowerCase()
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setQuery(active ? '' : s)}
                        aria-pressed={active}
                        className={`min-h-[36px] px-4 rounded-full text-sm font-medium border transition-colors ${
                          active ? 'text-white border-transparent' : 'border-[--border-subtle] text-[--text-muted] hover:text-[--text-primary]'
                        }`}
                        style={active ? { backgroundColor: accent } : undefined}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {/* Mobile: horizontally scrollable pills */}
            <div className="lg:hidden -mx-4 px-4 mb-6 overflow-x-auto pb-2 scrollbar-none">
              <div className="flex gap-2 w-max">
                {topics.map(topic => (
                  <button
                    key={topic}
                    onClick={() => setActiveTab(topic)}
                    className={`${tabClass(activeTab === topic)} flex-shrink-0`}
                    style={tabStyle(activeTab === topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
            {/* Desktop: wrap so every tab is visible */}
            <div className="hidden lg:flex flex-wrap gap-2 mb-6">
              {topics.map(topic => (
                <button
                  key={topic}
                  onClick={() => setActiveTab(topic)}
                  className={tabClass(activeTab === topic)}
                  style={tabStyle(activeTab === topic)}
                  data-testid="topic-tab-desktop"
                >
                  {topic}
                </button>
              ))}
            </div>
          </>
        )}

        {loading ? (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {SKELETON_KEYS.map(i => (
              <div key={i} className="bg-[--bg-card] border border-[--border-subtle] rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-[--text-muted] text-center px-4">
            <div className="text-5xl sm:text-6xl mb-4" aria-hidden="true">{emptyIcon}</div>
            {searching ? (
              <>
                <p className="text-base sm:text-lg font-medium">
                  No results for <span className="text-[--text-primary]">“{query.trim()}”</span>
                  {activeTab !== 'all' && <> in <span className="text-[--text-primary] capitalize">{activeTab}</span></>}.
                </p>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="mt-4 min-h-[44px] px-5 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: accent }}
                >
                  Clear search
                </button>
              </>
            ) : activeTab !== 'all' ? (
              <>
                <p className="text-base sm:text-lg font-medium">
                  No <span className="text-[--text-primary] capitalize">{activeTab}</span> news yet.
                </p>
                <p className="text-sm mt-2">Try selecting a different topic above.</p>
              </>
            ) : (
              <>
                <p className="text-base sm:text-lg font-medium text-[--text-primary]">No {emptyLabel} yet.</p>
                <p className="text-sm mt-2">Check back after 9 AM when the AI agent runs.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-10 max-w-5xl mx-auto">
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
        selectedCount={selection.selected.length}
        format="linkedin"
        maxItems={MAX_ITEMS}
        onGenerate={fmt => gen.generate(fmt, selection.selected)}
        onClear={selection.clear}
        isGenerating={gen.isGenerating}
      />

      <ContentModal
        isOpen={gen.modalOpen}
        onClose={gen.close}
        content={gen.content}
        isGenerating={gen.isGenerating}
        selectedItems={gen.generatedItems}
        format={gen.format}
        onRefine={gen.refine}
        notice={gen.notice}
      />
    </div>
  )
}
