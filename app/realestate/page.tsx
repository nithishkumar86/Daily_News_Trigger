'use client'
import TopicFeedPage from '@/components/TopicFeedPage'
import { REAL_ESTATE_NEWS_TABLE } from '@/lib/supabase'

const TOPICS = ['all', 'realestate', 'property', 'housing', 'realty']

export default function RealEstatePage() {
  return (
    <TopicFeedPage
      table={REAL_ESTATE_NEWS_TABLE}
      channel="real-estate-news-page"
      fixedTopics={TOPICS}
      accent="#10b981"
      title="Real Estate News"
      subtitle="Property, housing, and real estate market moves"
      emptyIcon="🏠"
      emptyLabel="real estate news"
      countNoun={['story', 'stories']}
    />
  )
}
