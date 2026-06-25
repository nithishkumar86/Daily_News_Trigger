export interface NewsArticle {
  id: string
  Rank: number
  Title: string
  Summary: string
  Link: string
  created_at: string
}

export interface WebhookPayload {
  rank: number
  title: string
  summary: string
  link: string
}
