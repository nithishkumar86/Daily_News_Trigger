'use client'
import TopicFeedPage from '@/components/TopicFeedPage'
import { AI_NEWS_TABLE } from '@/lib/supabase'

const TOPICS = ['all', 'trending', 'ai', 'models', 'tools']

export default function AIPage() {
  return (
    <TopicFeedPage
      table={AI_NEWS_TABLE}
      channel="ai-news-page"
      fixedTopics={TOPICS}
      accent="#7c3aed"
      title="AI News"
      subtitle="All AI updates — models, tools, research"
      emptyIcon="🤖"
      emptyLabel="AI news"
      countNoun={['article', 'articles']}
    />
  )
}
