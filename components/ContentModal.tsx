'use client'
import { useEffect, useState } from 'react'
import { NewsItem, ContentFormat, Message } from '@/lib/types'
import {
  CtaImage,
  NEWSLETTER_CTA_PATH,
  NEWSLETTER_CTA_SECTION,
  NEWSLETTER_SECTIONS,
  SectionImage,
  buildPostingBlocks,
  buildPostingHtml,
  imageSrcOf,
} from '@/lib/newsFeed'
import { X } from 'lucide-react'

interface ContentModalProps {
  isOpen: boolean
  onClose: () => void
  content: string
  isGenerating: boolean
  selectedItems: Array<NewsItem & { Section?: string }>
  format: ContentFormat | null
  // Omitted for pipeline drafts — the refine box is hidden
  onRefine?: (refinement: string) => void
  notice?: string
  // Pipeline infographics (one per newsletter section, or the article hero). When given,
  // they replace the news-item photos everywhere: on screen and in the copied post.
  generatedImages?: SectionImage[]
  // Pipeline newsletters end with the fixed "Thanks for Reading & Sharing!" image
  withCta?: boolean
}

export default function ContentModal({
  isOpen,
  onClose,
  content,
  isGenerating,
  selectedItems,
  format,
  onRefine,
  notice,
  generatedImages,
  withCta,
}: ContentModalProps) {
  const [refinementText, setRefinementText] = useState('')
  const [copiedText, setCopiedText] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  // Reply to a comment — LinkedIn posts and Drafts newsletters only. postText starts
  // as the generated content but stays editable, so a reply can still be drafted after
  // the post was published and this modal reopened or the live content is stale.
  const [postText, setPostText] = useState(content)
  const [commenterName, setCommenterName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [copiedReply, setCopiedReply] = useState(false)

  useEffect(() => {
    setPostText(content)
    setReplyText('')
    setReplyError('')
  }, [content, format])

  if (!isOpen) return null

  const canReply = format === 'linkedin' || format === 'newsletter'

  const handleGenerateReply = async () => {
    if (!postText.trim() || !commentText.trim() || replyLoading) return
    setReplyLoading(true)
    setReplyError('')
    try {
      const res = await fetch('/api/generate-comment-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postContent: postText, comment: commentText, name: commenterName.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || typeof json.reply !== 'string') {
        setReplyError(typeof json.error === 'string' ? json.error : 'Failed to generate a reply. Please try again.')
        return
      }
      setReplyText(json.reply)
    } catch {
      setReplyError('Failed to generate a reply. Please try again.')
    } finally {
      setReplyLoading(false)
    }
  }

  const handleCopyReply = async () => {
    await navigator.clipboard.writeText(replyText)
    setCopiedReply(true)
    setTimeout(() => setCopiedReply(false), 2000)
  }

  const firstItem = selectedItems[0]
  const imageSrc = (() => {
    if (generatedImages) return generatedImages[0]?.src ?? null
    if (!firstItem?.Image) return null
    if (firstItem.Image.startsWith('http')) return firstItem.Image
    if (firstItem.Image.startsWith('data:')) return firstItem.Image
    const stripped = firstItem.Image.replace(/=+$/, '')
    const pad = stripped.length % 4
    const b64 = pad === 0 ? stripped : stripped + '='.repeat(4 - pad)
    return `data:image/jpeg;base64,${b64}`
  })()

  // Newsletter picks carry a Section tag; article/linkedin selections never do,
  // so this is false for them and their single-image rendering stays unchanged.
  const isNewsletterMulti = format === 'newsletter' && (!!generatedImages || selectedItems.some(i => i.Section))

  // Up to 5 items can be picked per section now, so every picked item's image
  // is collected (was: only the first), grouped by canonical section order.
  const sectionImages: SectionImage[] = generatedImages
    ? generatedImages
    : isNewsletterMulti
    ? NEWSLETTER_SECTIONS
        .flatMap(label => selectedItems.filter(i => i.Section === label))
        .filter((i): i is NewsItem & { Section: string } => !!i.Image)
        .map(i => ({ item: i, src: imageSrcOf(i.Image) }))
        .filter((x): x is { item: NewsItem & { Section: string }; src: string } => !!x.src)
    : []

  // Absolute URL: a relative src breaks once the copied HTML is pasted into another site
  const cta: CtaImage | undefined =
    withCta && typeof window !== 'undefined'
      ? { src: new URL(NEWSLETTER_CTA_PATH, window.location.origin).href, alt: NEWSLETTER_CTA_SECTION }
      : undefined

  // Same blocks drive the on-screen view and the copied HTML, so what you see is what you paste
  const postingBlocks = isNewsletterMulti && content ? buildPostingBlocks(content, sectionImages, cta) : []

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(content)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const handleCopyImage = async (src: string, key: string) => {
    try {
      const img = new window.Image()
      if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = src
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || 512
      canvas.height = img.naturalHeight || 512
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('blob failed')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      alert('Image copy not supported in this browser. Please right-click the image to save it.')
    }
  }

  // Copies one HTML blob (heading → image → body for each of the 4 sections, then
  // the rest) ready to paste into a posting tool. The HTML itself is built synchronously
  // by the pure buildPostingHtml helper — no `await` happens before the
  // clipboard.write call, since an `await` first would drop the user-activation
  // flag Safari requires for `text/html` + `text/plain` clipboard writes.
  const handleCopyAll = async () => {
    try {
      const html = buildPostingHtml(content, sectionImages, cta)
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([content], { type: 'text/plain' }),
        }),
      ])
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch {
      alert('Combined copy not supported in this browser. Please copy the text and images separately.')
    }
  }

  const handleRefine = () => {
    if (!refinementText.trim() || !onRefine) return
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
          {/* Image Section — newsletter images render inline with the text below */}
          {!isNewsletterMulti && (
            imageSrc && (
              <div className="space-y-2">
                {/* A generated infographic carries text — show it whole, never cropped */}
                <img
                  src={imageSrc}
                  alt={generatedImages?.[0]?.item.Title ?? firstItem?.Title}
                  className={generatedImages ? 'block w-full h-auto rounded-xl' : 'w-full rounded-xl object-cover max-h-64'}
                />
                <button
                  onClick={() => handleCopyImage(imageSrc, 'single')}
                  className="text-xs px-3 py-1 rounded-lg bg-[#1a1a2e] text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
                >
                  {copiedKey === 'single' ? '✅ Image Copied!' : '📋 Copy Image'}
                </button>
              </div>
            )
          )}

          {notice && !isGenerating && (
            <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}

          {/* Generated Content */}
          <div className="bg-[#0d0d1a] rounded-xl p-4 border border-[#1e293b]">
            {isGenerating ? (
              <div className="flex items-center gap-3 text-[#94a3b8]">
                <span className="inline-block w-4 h-4 border-2 border-[#7c3aed]/30 border-t-[#7c3aed] rounded-full animate-spin" />
                Generating content...
              </div>
            ) : isNewsletterMulti ? (
              <div className="space-y-3">
                {postingBlocks.map((b, i) =>
                  b.kind === 'text' ? (
                    <pre key={i} className="text-[#f1f5f9] text-sm whitespace-pre-wrap font-sans leading-relaxed">
                      {b.text}
                    </pre>
                  ) : (
                    <div key={i} className="space-y-1">
                      {b.label && <h4 className="text-[#f1f5f9] text-sm font-semibold">{b.section}</h4>}
                      {/* Scale the whole image to the modal width — never crop its sides */}
                      <img src={b.src} alt={b.alt} className="block w-full h-auto rounded-xl" />
                    </div>
                  )
                )}
              </div>
            ) : (
              <pre className="text-[#f1f5f9] text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {content}
              </pre>
            )}
          </div>

          {/* Copy — newsletter gets ONE button for images + text together */}
          {content && !isGenerating && (
            <div className="flex flex-wrap gap-2">
              {isNewsletterMulti ? (
                <button
                  onClick={handleCopyAll}
                  className="text-sm px-4 py-2 rounded-lg bg-[#7c3aed] text-white hover:bg-purple-600 transition-colors"
                >
                  {copiedAll ? '✅ Copied! Paste it to post' : '📋 Copy Newsletter (Images + Text)'}
                </button>
              ) : (
                <button
                  onClick={handleCopyText}
                  className="text-sm px-4 py-2 rounded-lg bg-[#7c3aed] text-white hover:bg-purple-600 transition-colors"
                >
                  {copiedText ? '✅ Copied!' : '📋 Copy Content'}
                </button>
              )}
            </div>
          )}

          {/* Reply to a Comment — LinkedIn and newsletter only */}
          {canReply && !isGenerating && (
            <div className="space-y-3 border-t border-[#1e293b] pt-4">
              <p className="text-[#94a3b8] text-xs font-medium">Reply to a comment</p>

              <div className="space-y-1">
                <label className="text-[#64748b] text-xs">
                  Post or edition text (edit or paste it in if replying later)
                </label>
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder="Paste the published post or newsletter edition here"
                  rows={3}
                  className="w-full bg-[#0d0d1a] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#7c3aed] resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#64748b] text-xs">Commenter&apos;s name (optional)</label>
                <input
                  type="text"
                  value={commenterName}
                  onChange={e => setCommenterName(e.target.value)}
                  placeholder="e.g. Yazhini"
                  className="w-full bg-[#0d0d1a] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#7c3aed]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#64748b] text-xs">Reader&apos;s comment</label>
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Paste the reader's comment here"
                  rows={2}
                  className="w-full bg-[#0d0d1a] border border-[#1e293b] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#7c3aed] resize-none"
                />
              </div>

              <button
                onClick={handleGenerateReply}
                disabled={!postText.trim() || !commentText.trim() || replyLoading}
                className="text-sm px-4 py-2 rounded-lg bg-[#1a1a2e] text-[#f1f5f9] hover:bg-[#7c3aed] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {replyLoading ? 'Generating reply...' : 'Generate reply →'}
              </button>

              {replyError && (
                <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
                  {replyError}
                </p>
              )}

              {replyText && !replyLoading && (
                <div className="space-y-2">
                  <pre className="text-[#f1f5f9] text-sm whitespace-pre-wrap font-sans leading-relaxed bg-[#0d0d1a] rounded-xl p-3 border border-[#1e293b]">
                    {replyText}
                  </pre>
                  <button
                    onClick={handleCopyReply}
                    className="text-xs px-3 py-1 rounded-lg bg-[#1a1a2e] text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
                  >
                    {copiedReply ? 'Copied!' : 'Copy Reply'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Refinement Section */}
          {onRefine && !isGenerating && content && (
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
