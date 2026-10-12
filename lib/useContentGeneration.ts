'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ContentFormat, Message, NewsItem } from '@/lib/types'
import { toGenerationPayload } from '@/lib/newsFeed'

const MAX_REFINEMENT_LENGTH = 2000
const TRUNCATED_NOTICE =
  'The output hit the length limit and may be cut off. Select fewer items or ask for a shorter version.'

// Generate + refine flow shared by every page that produces content
export function useContentGeneration() {
  const [format, setFormat] = useState<ContentFormat | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [content, setContent] = useState('')
  const [notice, setNotice] = useState<string | undefined>()
  const [history, setHistory] = useState<Message[]>([])
  // Snapshot of the items generated from — refinement and the modal image survive selection/realtime changes
  const [generatedItems, setGeneratedItems] = useState<Array<NewsItem & { Section?: string }>>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => { abortRef.current?.abort() }, [])

  const run = useCallback(async (body: object, failMessage: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsGenerating(true)
    setNotice(undefined)

    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || typeof json.content !== 'string') {
        // Show the server's reason (e.g. "Too many items") instead of a generic failure
        setContent(typeof json.error === 'string' ? json.error : failMessage)
        return
      }
      setContent(json.content)
      setHistory(json.updatedHistory ?? [])
      if (json.truncated) setNotice(TRUNCATED_NOTICE)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setContent(failMessage)
    } finally {
      if (abortRef.current === controller) setIsGenerating(false)
    }
  }, [])

  const generate = useCallback(async (fmt: ContentFormat, items: Array<NewsItem & { Section?: string }>) => {
    if (!items.length || isGenerating) return
    setFormat(fmt)
    setGeneratedItems(items)
    setContent('')
    setHistory([])
    setModalOpen(true)
    await run({ format: fmt, selectedItems: toGenerationPayload(items) }, 'Failed to generate content. Please try again.')
  }, [isGenerating, run])

  const refine = useCallback(async (refinement: string) => {
    if (!format || isGenerating) return
    await run(
      {
        format,
        selectedItems: toGenerationPayload(generatedItems),
        refinement: refinement.slice(0, MAX_REFINEMENT_LENGTH),
        history,
      },
      'Failed to refine content. Please try again.'
    )
  }, [format, isGenerating, generatedItems, history, run])

  const close = useCallback(() => {
    abortRef.current?.abort()
    setIsGenerating(false)
    setModalOpen(false)
    setContent('')
    setNotice(undefined)
    setHistory([])
  }, [])

  return { format, isGenerating, modalOpen, content, notice, generatedItems, generate, refine, close }
}
