'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react'
import type { NewsArticle } from '@/lib/types'

const MCP_URL = 'https://daily-news-trigger.vercel.app/api/mcp'

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
    const interval = setInterval(fetchArticles, 30000)
    return () => clearInterval(interval)
  }, [fetchArticles])

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Daily AI News</h1>
        <p className="text-neutral-500 text-sm">{todayLabel}</p>
      </div>

      {/* MCP URL */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-2">
        <p className="text-xs text-neutral-500 uppercase tracking-widest font-medium">MCP Server — connect Claude or ChatGPT</p>
        <code className="block text-green-400 text-sm font-mono bg-neutral-800 px-4 py-3 rounded-lg break-all">
          {MCP_URL}
        </code>
        <p className="text-xs text-neutral-600">
          Tool: <code className="text-neutral-400">send_news</code> — fields: Rank, Title, Summary, Link, Date (optional)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <p className="text-xs text-neutral-500 uppercase tracking-widest">Today&apos;s Articles</p>
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
            <p className="text-xs text-neutral-700 mt-1">{lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>
      </div>

      {/* News Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-white">Today&apos;s News</h2>
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
            No articles for today — use the MCP tool to send news items.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-widest w-16">Rank</th>
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-widest w-56">Title</th>
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-widest">Summary</th>
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-widest w-16 text-center">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold font-mono">
                        {article.Rank}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white leading-snug line-clamp-2">{article.Title}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-neutral-400 leading-relaxed line-clamp-2">{article.Summary}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <a
                        href={article.Link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-neutral-600 hover:text-blue-400 transition-colors"
                        aria-label="Open article"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
