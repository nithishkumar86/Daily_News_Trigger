export interface NewsArticle {
  id: string
  Rank: string
  Title: string
  Summary: string
  Link: string
  Date: string
  created_at: string
}

export interface WebhookPayload {
  Rank: string
  Title: string
  Summary: string
  Link: string
  Date?: string
}
