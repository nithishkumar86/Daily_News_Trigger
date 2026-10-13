'use client'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

interface SubmittedBannerProps {
  kind: 'newsletter' | 'article'
  submittedId: string | null
  error: string | null
  onDismiss: () => void
}

// Bottom bar shown after Submit: confirms the job is queued for the morning run, or shows why it failed
export default function SubmittedBanner({ kind, submittedId, error, onDismiss }: SubmittedBannerProps) {
  if (!submittedId && !error) return null
  const label = kind === 'newsletter' ? 'newsletter' : 'article'

  return (
    <div
      role="status"
      className={`fixed bottom-0 left-0 right-0 z-50 border-t p-4 shadow-2xl ${
        error ? 'bg-[--bg-danger] border-red-900/60' : 'bg-[--bg-card] border-[--border-subtle]'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {error ? (
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={20} className="text-[--accent-purple-mid] shrink-0 mt-0.5" />
          )}
          <p className="text-sm text-[--text-soft]">
            {error ? (
              error
            ) : (
              <>
                <span className="font-semibold">Submitted.</span> Claude writes your {label} and Codex creates the images
                on the next morning run. Follow it in Drafts.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!error && (
            <Link
              href="/drafts"
              className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg bg-[--accent-purple] text-white text-sm font-medium hover:bg-purple-600 transition-colors"
            >
              Open Drafts →
            </Link>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[--text-muted] hover:text-[--text-primary] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
