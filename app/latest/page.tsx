'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { getBrowserSupabase } from '@/lib/supabase'
import { NewsItem, ContentFormat, Message } from '@/lib/types'
import NewsCard from '@/components/NewsCard'
import ContentGeneratorPanel from '@/components/ContentGeneratorPanel'

const ContentModal = dynamic(() => import('@/components/ContentModal'), { ssr: false })

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5]
const MAX_REFINEMENT_LENGTH = 2000

export default function LatestPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [selectedFormat, setSelectedFormat] = useState<ContentFormat | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [history, setHistory] = useState<Message[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const selectedItems = useMemo(() => items.filter(i => checkedIds.has(i.id)), [items, checkedIds])
  const allSelected = useMemo(() => items.length > 0 && checkedIds.size === items.length, [items.length, checkedIds.size])

  const loadItems = useCallback(async () => {
    try {
      const supabase = getBrowserSupabase()
      const { data: maxRow, error: maxErr } = await supabase
        .from('ai_news')
        .select('Date')
        .order('Date', { ascending: false })
        .limit(1)
        .single()

      if (maxErr || !maxRow) { setLoading(false); return }

      const { data, error } = await supabase
        .from('ai_news')
        .select('id, Rank, Topic, Title, Summary, Image, Link, Date')
        .eq('Date', maxRow.Date)
        .eq('Topic', 'trending')
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
      .channel('latest-ai-news')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_news' }, loadItems)
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

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(items.map(i => i.id)))
    }
  }, [allSelected, items])

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
        <div className="mb-6 sm:mb-8 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#f1f5f9]">Latest Trending</h1>
              <p className="text-[#94a3b8] mt-1 text-sm sm:text-base">Today&apos;s most viral AI news</p>
            </div>
            {!loading && items.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-xs text-[#7c3aed] hover:text-[#3b82f6] transition-colors shrink-0 underline underline-offset-2"
              >
                {allSelected ? 'Clear All' : `Select All (${items.length})`}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {SKELETON_KEYS.map(i => (
              <div key={i} className="bg-[#13131f] border border-[#1e293b] rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-[#94a3b8]">
            <div className="text-5xl sm:text-6xl mb-4">📰</div>
            <p className="text-base sm:text-lg font-medium">No trending news yet today.</p>
            <p className="text-sm mt-2 text-center max-w-xs">Check back after 9 AM when the AI agent runs.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {items.map(item => (
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
