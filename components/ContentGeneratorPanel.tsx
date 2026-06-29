'use client'
import { ContentFormat } from '@/lib/types'

interface ContentGeneratorPanelProps {
  selectedCount: number
  onGenerate: (format: ContentFormat) => void
  onClear: () => void
  isGenerating: boolean
  selectedFormat: ContentFormat | null
  onSelectFormat: (format: ContentFormat) => void
  excludeFormats?: ContentFormat[]
}

const formats: { key: ContentFormat; label: string; icon: string }[] = [
  { key: 'article', label: 'Article', icon: '📄' },
  { key: 'newsletter', label: 'Newsletter', icon: '📧' },
  { key: 'linkedin', label: 'LinkedIn Post', icon: '💼' },
]

export default function ContentGeneratorPanel({
  selectedCount,
  onGenerate,
  onClear,
  isGenerating,
  selectedFormat,
  onSelectFormat,
  excludeFormats,
}: ContentGeneratorPanelProps) {
  if (selectedCount === 0) return null

  const visibleFormats = excludeFormats?.length
    ? formats.filter(f => !excludeFormats.includes(f.key))
    : formats

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#13131f] border-t border-[#1e293b] p-4 shadow-2xl">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[#94a3b8] text-base">
              <span className="text-[#7c3aed] font-bold">{selectedCount}</span> item{selectedCount > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              {visibleFormats.map(f => (
                <button
                  key={f.key}
                  onClick={() => onSelectFormat(f.key)}
                  className={`px-4 py-2 rounded-lg text-base font-medium transition-all ${
                    selectedFormat === f.key
                      ? 'bg-[#7c3aed] text-white'
                      : 'bg-[#1a1a2e] text-[#94a3b8] hover:bg-[#1e293b] hover:text-[#f1f5f9]'
                  }`}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClear}
              className="text-sm text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
            >
              ✕ Clear
            </button>
            <button
              onClick={() => selectedFormat && onGenerate(selectedFormat)}
              disabled={!selectedFormat || isGenerating}
              className="px-5 py-2.5 rounded-lg bg-[#7c3aed] text-white text-base font-medium hover:bg-purple-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                'Generate Content →'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
