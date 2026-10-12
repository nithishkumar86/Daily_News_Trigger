'use client'
import TopicFeedPage from '@/components/TopicFeedPage'
import { JOB_NEWS_TABLE } from '@/lib/supabase'

const TOPICS = ['all', 'hiring', 'layoffs', 'jobs', 'hr']

export default function JobPage() {
  return (
    <TopicFeedPage
      table={JOB_NEWS_TABLE}
      channel="job-news-page"
      fixedTopics={TOPICS}
      accent="#f59e0b"
      title="Job News"
      subtitle="Company hiring, layoffs, and workforce moves"
      emptyIcon="💼"
      emptyLabel="job news"
      countNoun={['story', 'stories']}
    />
  )
}
