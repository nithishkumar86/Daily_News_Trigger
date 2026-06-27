export interface NewsItem {
  id: string
  Rank: number
  Topic: string
  Title: string
  Summary: string
  Image: string | null
  Link: string
  Date: string
  created_at: string
}

export type TableName = 'ai_news' | 'investment_news'

export interface WebhookBody {
  table: TableName
  items: Array<{
    Rank: number
    Topic: string
    Title: string
    Summary: string
    Image?: string
    Link: string
    Date?: string
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
