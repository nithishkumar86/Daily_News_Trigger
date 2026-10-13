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
  }, [])

  return (
    <div className="min-h-screen bg-[--bg-primary]">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] sm:min-h-[80vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--bg-primary] via-[--bg-elevated] to-[--bg-primary]" />
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[--accent-purple] via-transparent to-transparent" />

        {/* Content */}
        <div className="relative z-10 text-center space-y-5 sm:space-y-6 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 bg-[--accent-purple]/10 border border-[--accent-purple]/20 rounded-full px-4 py-1.5 text-base sm:text-lg text-[--accent-purple] font-medium leading-snug">
            🤖 AI-Powered Daily News
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold text-[--text-primary] leading-tight">
            AI Digital{' '}
            <span className="text-[--accent-purple]">Tamizha</span>
          </h1>
          <p className="text-xl sm:text-2xl text-[--text-muted] max-w-2xl mx-auto leading-relaxed">
            Your Daily Dose of AI Intelligence — curated by AI, delivered daily
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 w-full">
            <Link
              href="/latest"
              className="min-h-[56px] flex items-center justify-center px-8 py-4 bg-[--accent-purple] text-white text-lg rounded-xl font-medium hover:bg-purple-600 transition-all w-full sm:w-auto"
            >
              Latest Trending
            </Link>
            <Link
              href="/ai"
              className="min-h-[56px] flex items-center justify-center px-8 py-4 bg-[--bg-elevated] border border-[--border-subtle] text-[--text-primary] text-lg rounded-xl font-medium hover:border-[--accent-purple] transition-all w-full sm:w-auto"
            >
              AI News
            </Link>
            <Link
              href="/investment"
              className="min-h-[56px] flex items-center justify-center px-8 py-4 bg-[--bg-elevated] border border-[--border-subtle] text-[--text-primary] text-lg rounded-xl font-medium hover:border-[--accent-blue] transition-all w-full sm:w-auto"
            >
              Investment News
            </Link>
            <Link
              href="/job"
              className="min-h-[56px] flex items-center justify-center px-8 py-4 bg-[--bg-elevated] border border-[--border-subtle] text-[--text-primary] text-lg rounded-xl font-medium hover:border-[--accent-amber] transition-all w-full sm:w-auto"
            >
              Job News
            </Link>
          </div>
        </div>
      </section>

      {/* Marquee Ticker */}
      {headlines.length > 0 ? (
        <section className="bg-[--bg-card] border-y border-[--border-subtle] py-3">
          <Marquee items={headlines} />
        </section>
      ) : (
        <div className="border-t border-[--border-subtle]" />
      )}

      {/* Quick Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[
            { label: 'Daily AI News', value: '5–10+', color: '#7c3aed', icon: '🧠' },
            { label: 'Investment Stories', value: '5+', color: '#3b82f6', icon: '📈' },
            { label: 'Updated', value: 'Daily 9AM', color: '#10b981', icon: '⏰' },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-[--bg-card] border border-[--border-subtle] rounded-xl p-6 sm:p-8 text-center flex flex-col items-center gap-2"
            >
              <span className="text-2xl" aria-hidden="true">{stat.icon}</span>
              <div className="text-5xl lg:text-6xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-[--text-muted] text-xl mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
