'use client'
import { ContentFormat } from '@/lib/types'

interface ContentGeneratorPanelProps {
  selectedCount: number
  format: ContentFormat
  maxItems?: number
  onGenerate: (format: ContentFormat) => void
  onClear: () => void
  isGenerating: boolean
  // Override the button text, e.g. "Submit Newsletter →" for the automated pipeline
  actionLabel?: string
  busyLabel?: string
}

const formatLabel: Record<ContentFormat, string> = {
  article: 'Article',
  newsletter: 'Newsletter',
  linkedin: 'LinkedIn Post',
}

export default function ContentGeneratorPanel({
  selectedCount,
  format,
  maxItems,
  onGenerate,
  onClear,
  isGenerating,
  actionLabel,
  busyLabel = 'Generating...',
}: ContentGeneratorPanelProps) {
  if (selectedCount === 0) return null

  const overLimit = maxItems !== undefined && selectedCount > maxItems

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[--bg-card] border-t border-[--border-subtle] p-4 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <span className="text-[--text-muted] text-base">
          <span className="text-[--accent-purple] font-bold">{selectedCount}</span> item{selectedCount > 1 ? 's' : ''} selected
          {overLimit && <span className="ml-2 text-red-400 text-sm">Max {maxItems} items</span>}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            className="min-h-[44px] text-sm text-[--text-muted] hover:text-[--text-primary] transition-colors"
          >
            ✕ Clear
          </button>
          <button
            onClick={() => onGenerate(format)}
            disabled={isGenerating || overLimit}
            className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[--accent-purple] text-white text-base font-medium hover:bg-purple-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {busyLabel}
              </span>
            ) : (
              actionLabel ?? `Generate ${formatLabel[format]} →`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
