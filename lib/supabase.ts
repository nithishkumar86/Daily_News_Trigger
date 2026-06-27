import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const AI_NEWS_TABLE = 'ai_news'
export const INVESTMENT_NEWS_TABLE = 'investment_news'
export const CLEANUP_LOG_TABLE = 'cleanup_log'

// Browser client — uses NEXT_PUBLIC_ keys, safe in components
let browserClient: SupabaseClient | null = null

export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  browserClient = createClient(url, key)
  return browserClient
}

// Server client — uses service role key, server-side only
let serverClient: SupabaseClient | null = null

export function getServerSupabase(): SupabaseClient {
  if (serverClient) return serverClient
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  serverClient = createClient(url, key, {
    auth: { persistSession: false }
  })
  return serverClient
}

// Legacy export for backwards compatibility with existing MCP route
export function getSupabase(): SupabaseClient {
  return getServerSupabase()
}

// Legacy table name export for backwards compatibility with existing API routes
export const TABLE_NAME = process.env.SUPABASE_TABLE_NAME ?? 'Dialy_News_Trigger'
