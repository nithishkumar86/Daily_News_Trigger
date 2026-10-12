'use client'
import TopicFeedPage from '@/components/TopicFeedPage'
import { INVESTMENT_NEWS_TABLE } from '@/lib/supabase'

const TOPICS = ['all', 'startup', 'funding', 'investment', 'company']

export default function InvestmentPage() {
  return (
    <TopicFeedPage
      table={INVESTMENT_NEWS_TABLE}
      channel="investment-news-page"
      fixedTopics={TOPICS}
      accent="#3b82f6"
      title="Investment News"
      subtitle="Startup funding, VC deals, and company news"
      emptyIcon="💰"
      emptyLabel="investment news"
      countNoun={['story', 'stories']}
    />
  )
}
