'use client'
import { useEffect, useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase'
import { NewsItem, ContentFormat, Message } from '@/lib/types'
import NewsCard from '@/components/NewsCard'
import ContentGeneratorPanel from '@/components/ContentGeneratorPanel'
import ContentModal from '@/components/ContentModal'

export default function LatestPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [selectedFormat, setSelectedFormat] = useState<ContentFormat | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [history, setHistory] = useState<Message[]>([])
  const [activeFormat, setActiveFormat] = useState<ContentFormat | null>(null)

  const loadItems = useCallback(async () => {
    try {
      const supabase = getBrowserSupabase()
      const { data: maxRow } = await supabase
        .from('ai_news')
        .select('Date')
        .order('Date', { ascending: false })
        .limit(1)
        .single()

      if (!maxRow) { setLoading(false); return }

      const { data } = await supabase
        .from('ai_news')
        .select('*')
        .eq('Date', maxRow.Date)
        .eq('Topic', 'trending')
        .order('Rank', { ascending: true })

      setItems(data ?? [])
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

  const handleToggle = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleGenerate = async (format: ContentFormat) => {
    const selectedItems = items.filter(i => checkedIds.has(i.id))
    if (!selectedItems.length) return
    setActiveFormat(format)
    setIsGenerating(true)
    setGeneratedContent('')
    setHistory([])
    setModalOpen(true)

    const res = await fetch('/api/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, selectedItems }),
    })
    const json = await res.json()
    setGeneratedContent(json.content ?? json.error ?? 'Error generating content')
    setHistory(json.updatedHistory ?? [])
    setIsGenerating(false)
  }

  const handleRefine = async (refinement: string) => {
    const selectedItems = items.filter(i => checkedIds.has(i.id))
    setIsGenerating(true)
    const res = await fetch('/api/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: activeFormat, selectedItems, refinement, history }),
    })
    const json = await res.json()
    setGeneratedContent(json.content ?? json.error ?? 'Error')
    setHistory(json.updatedHistory ?? [])
    setIsGenerating(false)
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] pb-32">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#f1f5f9]">Latest Trending</h1>
          <p className="text-[#94a3b8] mt-1">Today&apos;s most viral AI news</p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-6 max-w-3xl mx-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#13131f] border border-[#1e293b] rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 text-[#94a3b8]">
            <div className="text-5xl mb-4">📰</div>
            <p className="text-lg">No trending news yet today.</p>
            <p className="text-sm mt-2">Check back after 9 AM when the AI agent runs.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-3xl mx-auto">
            {items.map(item => (
              <NewsCard key={item.id} item={item} checked={checkedIds.has(item.id)} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>

      <ContentGeneratorPanel
        selectedCount={checkedIds.size}
        onGenerate={handleGenerate}
        onClear={() => { setCheckedIds(new Set()); setSelectedFormat(null) }}
        isGenerating={isGenerating}
        selectedFormat={selectedFormat}
        onSelectFormat={setSelectedFormat}
      />

      <ContentModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setGeneratedContent(''); setHistory([]) }}
        content={generatedContent}
        isGenerating={isGenerating}
        selectedItems={items.filter(i => checkedIds.has(i.id))}
        format={activeFormat}
        onRefine={handleRefine}
      />
    </div>
  )
}
