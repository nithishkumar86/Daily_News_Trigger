'use client'
import { useState } from 'react'
import { NewsItem, ContentFormat, Message } from '@/lib/types'
import { X } from 'lucide-react'

interface ContentModalProps {
  isOpen: boolean
  onClose: () => void
  content: string
  isGenerating: boolean
  selectedItems: NewsItem[]
  format: ContentFormat | null
  onRefine: (refinement: string) => void
}

export default function ContentModal({
  isOpen,
  onClose,
  content,
  isGenerating,
  selectedItems,
  format,
  onRefine,
}: ContentModalProps) {
  const [refinementText, setRefinementText] = useState('')
  const [copiedText, setCopiedText] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)

  if (!isOpen) return null

  const firstItem = selectedItems[0]
  const imageSrc = firstItem?.image
    ? firstItem.image.startsWith('data:')
      ? firstItem.image
      : `data:image/jpeg;base64,${firstItem.image}`
    : null

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(content)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const handleCopyImage = async () => {
    if (!imageSrc) return
    try {
      const response = await fetch(imageSrc)
      const blob = await response.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2000)
    } catch {
      alert('Image copy not supported in this browser. Please right-click the image to save it.')
    }
  }

  const handleRefine = () => {
    if (!refinementText.trim()) return
    onRefine(refinementText.trim())
    setRefinementText('')
  }

  const formatLabel: Record<ContentFormat, string> = {
    article: '📄 Article',
    newsletter: '📧 Newsletter',
    linkedin: '💼 LinkedIn Post',
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#13131f] border border-[#1e293b] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1e293b] sticky top-0 bg-[#13131f] z-10">
          <span className="text-[#f1f5f9] font-semibold">
            {format ? formatLabel[format] : 'Generated Content'}
          </span>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#f1f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Image Section */}
          {imageSrc && (
            <div className="space-y-2">
              <img src={imageSrc} alt={firstItem?.title} className="w-full rounded-xl object-cover max-h-64" />
              <button
                onClick={handleCopyImage}
                className="text-xs px-3 py-1 rounded-lg bg-[#1a1a2e] text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
              >
                {copiedImage ? '✅ Image Copied!' : '📋 Copy Image'}
              </button>
            </div>
          )}

          {/* Generated Content */}
          <div className="bg-[#0d0d1a] rounded-xl p-4 border border-[#1e293b]">
            {isGenerating ? (
              <div className="flex items-center gap-3 text-[#94a3b8]">
                <span className="inline-block w-4 h-4 border-2 border-[#7c3aed]/30 border-t-[#7c3aed] rounded-full animate-spin" />
                Generating content...
              </div>
            ) : (
              <pre className="text-[#f1f5f9] text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {content}
              </pre>
            )}
          </div>

          {/* Copy Content Button */}
          {content && !isGenerating && (
            <button
              onClick={handleCopyText}
              className="text-sm px-4 py-2 rounded-lg bg-[#7c3aed] text-white hover:bg-purple-600 transition-colors"
            >
              {copiedText ? '✅ Copied!' : '📋 Copy Content'}
            </button>
          )}

          {/* Refinement Section */}
          {!isGenerating && content && (
            <div className="space-y-2 border-t border-[#1e293b] pt-4">
              <p className="text-[#94a3b8] text-xs font-medium">💬 Want to change anything?</p>
              <textarea
                value={refinementText}
                onChange={e => setRefinementText(e.target.value)}
                placeholder='e.g. "Make it shorter", "Change tone to casual", "Add more technical detail"'
                rows={3}
                className="w-full bg-[#0d0d1a] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#7c3aed] resize-none"
              />
              <button
                onClick={handleRefine}
                disabled={!refinementText.trim()}
                className="text-sm px-4 py-2 rounded-lg bg-[#1a1a2e] text-[#f1f5f9] hover:bg-[#7c3aed] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Regenerate with changes →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
