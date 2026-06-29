'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { getBrowserSupabase } from '@/lib/supabase'
import { NewsItem, ContentFormat, Message } from '@/lib/types'
import NewsCard from '@/components/NewsCard'
import ContentGeneratorPanel from '@/components/ContentGeneratorPanel'

const ContentModal = dynamic(() => import('@/components/ContentModal'), { ssr: false })

const FIXED_INV_TOPICS = ['all', 'startup', 'funding', 'investment', 'company']
const SKELETON_KEYS = [0, 1, 2, 3, 4, 5]
const MAX_REFINEMENT_LENGTH = 2000

function getTabClass(active: boolean): string {
  return `min-h-[44px] py-2 px-5 rounded-full text-base font-medium transition-all whitespace-nowrap ${
    active ? 'bg-[#3b82f6] text-white' : 'bg-[#1a1a2e] text-[#94a3b8] hover:bg-[#1e293b]'
  }`
}

export default function InvestmentPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [selectedFormat, setSelectedFormat] = useState<ContentFormat | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [history, setHistory] = useState<Message[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const dbTopics = useMemo(
    () => Array.from(new Set(items.map(i => (i.Topic ?? '').trim().toLowerCase().slice(0, 50)))),
    [items]
  )
  const topics = useMemo(
    () => [...FIXED_INV_TOPICS, ...dbTopics.filter(t => !FIXED_INV_TOPICS.includes(t))],
    [dbTopics]
  )
  const filtered = useMemo(
    () => (activeTab === 'all' ? items : items.filter(i => i.Topic === activeTab)),
    [items, activeTab]
  )
  const selectedItems = useMemo(() => items.filter(i => checkedIds.has(i.id)), [items, checkedIds])
  const hasItems = !loading && items.length > 0

  const loadItems = useCallback(async () => {
    try {
      const supabase = getBrowserSupabase()
      const { data: maxRow, error: maxErr } = await supabase
        .from('investment_news')
        .select('Date')
        .order('Date', { ascending: false })
        .limit(1)
        .single()

      if (maxErr || !maxRow) { setLoading(false); return }

      const { data, error } = await supabase
        .from('investment_news')
        .select('id, Rank, Topic, Title, Summary, Image, Link, Date')
        .eq('Date', maxRow.Date)
        .order('Rank', { ascending: true })

      if (!error) setItems(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel('investment-news-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investment_news' }, loadItems)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadItems])

  // Abort in-flight requests on unmount
  useEffect(() => () => { abortRef.current?.abort() }, [])

  const handleToggle = useCallback((id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleGenerate = useCallback(async (format: ContentFormat) => {
    if (!selectedItems.length || isGenerating) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSelectedFormat(format)
    setIsGenerating(true)
    setGeneratedContent('')
    setHistory([])
    setModalOpen(true)

    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, selectedItems }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const json = await res.json()
      setGeneratedContent(json.content ?? json.error ?? 'Error generating content')
      setHistory(json.updatedHistory ?? [])
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGeneratedContent('Failed to generate content. Please try again.')
      }
    } finally {
      setIsGenerating(false)
    }
  }, [selectedItems, isGenerating])

  const handleRefine = useCallback(async (refinement: string) => {
    if (!selectedFormat || isGenerating) return
    const trimmed = refinement.slice(0, MAX_REFINEMENT_LENGTH)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: selectedFormat, selectedItems, refinement: trimmed, history }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const json = await res.json()
      setGeneratedContent(json.content ?? json.error ?? 'Error')
      setHistory(json.updatedHistory ?? [])
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGeneratedContent('Failed to refine content. Please try again.')
      }
    } finally {
      setIsGenerating(false)
    }
  }, [selectedFormat, isGenerating, selectedItems, history])

  const handleClear = useCallback(() => {
    setCheckedIds(new Set())
    setSelectedFormat(null)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setGeneratedContent('')
    setHistory([])
  }, [])

  return (
    <div className="min-h-screen bg-[#0d0d1a] pb-32 sm:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">

        {/* Page header */}
        <div className="mb-6 sm:mb-8 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#f1f5f9]">Investment News</h1>
            <p className="text-[#94a3b8] mt-1 text-sm sm:text-base">Startup funding, VC deals, and company news</p>
          </div>
          {hasItems && (
            <span className="self-start sm:self-auto inline-flex items-center px-3 py-1 rounded-full bg-[#1a1a2e] border border-[#1e293b] text-[#94a3b8] text-xs font-medium">
              {filtered.length} {filtered.length === 1 ? 'story' : 'stories'}
            </span>
          )}
        </div>

        {/* Topic filter tabs */}
        {hasItems && (
          <>
            {/* Mobile: horizontally scrollable, pills touch screen edges */}
            <div className="lg:hidden -mx-4 px-4 mb-6 overflow-x-auto pb-2 scrollbar-none">
              <div className="flex gap-2 w-max">
                {topics.map(topic => (
                  <button
                    key={topic}
                    onClick={() => setActiveTab(topic)}
                    className={`${getTabClass(activeTab === topic)} flex-shrink-0`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: flex-wrap so all tabs visible without scrolling */}
            <div className="hidden lg:flex flex-wrap gap-2 mb-6">
              {topics.map(topic => (
                <button
                  key={topic}
                  onClick={() => setActiveTab(topic)}
                  className={getTabClass(activeTab === topic)}
                  data-testid="topic-tab-desktop"
                >
                  {topic}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Content area */}
        {loading ? (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {SKELETON_KEYS.map(i => (
              <div key={i} className="bg-[#13131f] border border-[#1e293b] rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-[#94a3b8]">
            <div className="text-5xl sm:text-6xl mb-4" aria-hidden="true">💰</div>
            {activeTab !== 'all' ? (
              <>
                <p className="text-base sm:text-lg font-medium text-center">
                  No <span className="text-[#f1f5f9] capitalize">{activeTab}</span> news today.
                </p>
                <p className="text-sm mt-2 text-center">Try a different topic or check back after 9 AM.</p>
              </>
            ) : (
              <>
                <p className="text-base sm:text-lg font-medium text-center">No investment news yet today.</p>
                <p className="text-sm mt-2 text-center">Check back after 9 AM when the AI agent runs.</p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {filtered.map(item => (
              <NewsCard key={item.id} item={item} checked={checkedIds.has(item.id)} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>

      <ContentGeneratorPanel
        selectedCount={checkedIds.size}
        onGenerate={handleGenerate}
        onClear={handleClear}
        isGenerating={isGenerating}
        selectedFormat={selectedFormat}
        onSelectFormat={setSelectedFormat}
        excludeFormats={['newsletter']}
      />

      <ContentModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        content={generatedContent}
        isGenerating={isGenerating}
        selectedItems={selectedItems}
        format={selectedFormat}
        onRefine={handleRefine}
      />
    </div>
  )
}
