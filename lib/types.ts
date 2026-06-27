export interface NewsItem {
  id: string
  rank: number
  topic: string
  title: string
  summary: string
  image: string | null
  link: string
  date: string
  created_at: string
}

export type TableName = 'ai_news' | 'investment_news'

export interface WebhookBody {
  table: TableName
  items: Array<{
    rank: number
    topic: string
    title: string
    summary: string
    image?: string
    link: string
    date?: string
  }>
}

export interface GenerateContentBody {
  format: ContentFormat
  selectedItems: NewsItem[]
  refinement?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export type ContentFormat = 'article' | 'newsletter' | 'linkedin'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}
