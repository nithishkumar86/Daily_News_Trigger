'use client'
import { useEffect, useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase'
import { NewsItem, ContentFormat, Message } from '@/lib/types'
import NewsCard from '@/components/NewsCard'
import ContentGeneratorPanel from '@/components/ContentGeneratorPanel'
import ContentModal from '@/components/ContentModal'

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
  const [activeFormat, setActiveFormat] = useState<ContentFormat | null>(null)

  const loadItems = useCallback(async () => {
    try {
      const supabase = getBrowserSupabase()
      const { data: maxRow } = await supabase
        .from('investment_news')
        .select('Date')
        .order('Date', { ascending: false })
        .limit(1)
        .single()

      if (!maxRow) { setLoading(false); return }

      const { data } = await supabase
        .from('investment_news')
        .select('*')
        .eq('Date', maxRow.Date)
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
      .channel('investment-news-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investment_news' }, loadItems)
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

  const FIXED_INV_TOPICS = ['all', 'startup', 'funding', 'investment', 'company']
  const dbTopics = Array.from(new Set(items.map(i => i.Topic)))
  const topics = [...FIXED_INV_TOPICS, ...dbTopics.filter(t => !FIXED_INV_TOPICS.includes(t))]
  const filtered = activeTab === 'all' ? items : items.filter(i => i.Topic === activeTab)

  return (
    <div className="min-h-screen bg-[#0d0d1a] pb-32">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#f1f5f9]">Investment News</h1>
          <p className="text-[#94a3b8] mt-1">Startup funding, VC deals, and company news</p>
        </div>

        {!loading && items.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
            {topics.map(topic => (
              <button
                key={topic}
                onClick={() => setActiveTab(topic)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === topic
                    ? 'bg-[#7c3aed] text-white'
                    : 'bg-[#1a1a2e] text-[#94a3b8] hover:bg-[#1e293b]'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#13131f] border border-[#1e293b] rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-[#94a3b8]">
            <div className="text-5xl mb-4">💰</div>
            <p className="text-lg">No investment news yet today.</p>
            <p className="text-sm mt-2">Check back after 9 AM when the AI agent runs.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            {filtered.map(item => (
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
