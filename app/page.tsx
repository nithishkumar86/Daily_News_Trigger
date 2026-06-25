'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, RefreshCw, ExternalLink, Webhook } from 'lucide-react'
import type { NewsArticle } from '@/lib/types'

export default function Page() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch('/api/news')
      const json = await res.json()
      if (json.success) {
        setArticles(json.data)
        setError(null)
      } else {
        setError(json.error)
      }
    } catch {
      setError('Failed to reach /api/news')
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }, [])

  useEffect(() => {
    fetchArticles()
    const interval = setInterval(fetchArticles, 5000)
    return () => clearInterval(interval)
  }, [fetchArticles])

  const webhookUrl = '/api/webhook'

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Webhook className="w-7 h-7 text-blue-400" />
        <div>
          <h1 className="text-xl font-bold text-white">News Webhook Tester</h1>
          <p className="text-neutral-500 text-sm">Receives data from AI agents → stores to Supabase</p>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
        <p className="text-xs text-neutral-500 uppercase tracking-widest font-medium">Webhook Endpoint</p>
        <code className="block text-green-400 text-sm font-mono bg-neutral-800 px-4 py-3 rounded-lg break-all">
          POST {webhookUrl}
        </code>
        <p className="text-xs text-neutral-600">
          Expected body:{' '}
          <code className="text-neutral-400">
            {'{ "rank": 1, "title": "...", "summary": "...", "link": "..." }'}
          </code>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <p className="text-xs text-neutral-500 uppercase tracking-widest">Articles Stored</p>
          <p className="text-3xl font-bold text-white mt-1">{articles.length}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <p className="text-xs text-neutral-500 uppercase tracking-widest">Supabase</p>
          <div className="flex items-center gap-2 mt-2">
            {error ? (
              <>
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm font-medium">Error</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm font-medium">Connected</span>
              </>
            )}
          </div>
          {lastUpdated && (
            <p className="text-xs text-neutral-700 mt-1">
              {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Articles List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-white">Received Articles</h2>
          <button
            onClick={fetchArticles}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-neutral-600 text-sm">Loading...</p>
        ) : error ? (
          <p className="px-5 py-10 text-center text-red-400 text-sm">{error}</p>
        ) : articles.length === 0 ? (
          <p className="px-5 py-10 text-center text-neutral-600 text-sm">
            No articles yet — trigger the webhook to see data here.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {articles.map((article) => (
              <li key={article.id} className="px-5 py-4 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono">
                      #{article.Rank}
                    </span>
                    <p className="text-sm font-medium text-white truncate">{article.Title}</p>
                  </div>
                  <a
                    href={article.Link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-neutral-600 hover:text-blue-400 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-sm text-neutral-400">{article.Summary}</p>
                <p className="text-xs text-neutral-700">
                  {new Date(article.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
