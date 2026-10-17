export interface NewsItem {
  id: string
  Rank: number
  Topic: string
  Title: string
  Summary: string
  Image: string | null
  Link: string
  Date: string
  created_at?: string
}

export type TableName = 'ai_news' | 'investment_news' | 'job_hire_fire' | 'real_estate_news'

// A news row tagged with the table it came from (for multi-table feeds)
export type FeedItem = NewsItem & { source: TableName }

export interface WebhookBody {
  items: Array<{
    Rank: number
    Topic: string
    Title: string
    Summary: string
    Image?: string
    ImageUrl?: string
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

export type ReplyMode = 'professional' | 'friendly'

export interface GenerateCommentReplyBody {
  postContent: string
  comment: string
  name?: string
  mode?: ReplyMode
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}
