'use client'
import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase'
import Marquee from '@/components/Marquee'
import Link from 'next/link'

interface HeadlineItem {
  Rank: number
  Title: string
  Topic: string
}

export default function HomePage() {
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([])

  useEffect(() => {
    async function loadHeadlines() {
      try {
        const supabase = getBrowserSupabase()
        const { data: maxRow } = await supabase
          .from('ai_news')
          .select('Date')
          .order('Date', { ascending: false })
          .limit(1)
          .single()

        if (!maxRow) return

        const { data } = await supabase
          .from('ai_news')
          .select('Rank, Title, Topic')
          .eq('Date', maxRow.Date)
          .order('Rank', { ascending: true })

        setHeadlines(data ?? [])
      } catch {
        // No data yet — headlines stay empty
      }
    }

    loadHeadlines()

    // Passive cleanup trigger (runs only on Sundays, idempotent)
    fetch('/api/check-cleanup').catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d1a] via-[#1a1a2e] to-[#0d0d1a]" />
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#7c3aed] via-transparent to-transparent" />

        {/* Content */}
        <div className="relative z-10 text-center space-y-6 px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-full px-4 py-1.5 text-sm text-[#7c3aed] font-medium">
            🤖 AI-Powered Daily News
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold text-[#f1f5f9] leading-tight">
            AI Digital{' '}
            <span className="text-[#7c3aed]">Tamizah</span>
          </h1>
          <p className="text-xl text-[#94a3b8] max-w-2xl mx-auto leading-relaxed">
            Your Daily Dose of AI Intelligence — curated by AI, delivered daily
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Link
              href="/latest"
              className="px-6 py-3 bg-[#7c3aed] text-white rounded-xl font-medium hover:bg-purple-600 transition-all"
            >
              Latest Trending
            </Link>
            <Link
              href="/ai"
              className="px-6 py-3 bg-[#1a1a2e] border border-[#1e293b] text-[#f1f5f9] rounded-xl font-medium hover:border-[#7c3aed] transition-all"
            >
              AI News
            </Link>
            <Link
              href="/investment"
              className="px-6 py-3 bg-[#1a1a2e] border border-[#1e293b] text-[#f1f5f9] rounded-xl font-medium hover:border-[#3b82f6] transition-all"
            >
              Investment News
            </Link>
          </div>
        </div>
      </section>

      {/* Marquee Ticker */}
      {headlines.length > 0 && (
        <section className="bg-[#13131f] border-y border-[#1e293b] py-3">
          <Marquee items={headlines} />
        </section>
      )}

      {/* Quick Stats */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: 'Daily AI News', value: '5–10+', color: '#7c3aed' },
            { label: 'Investment Stories', value: '5+', color: '#3b82f6' },
            { label: 'Updated', value: 'Daily 9AM', color: '#10b981' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#13131f] border border-[#1e293b] rounded-xl p-6 text-center">
              <div className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[#94a3b8] text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
