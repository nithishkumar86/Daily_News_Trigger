'use client'
import { useCallback, useState } from 'react'
import { NewsItem } from '@/lib/types'
import { toGenerationPayload } from '@/lib/newsFeed'
import { JobKind } from '@/lib/pipelineView'

// Submits the manager's picks to the automated pipeline (POST /api/content-jobs).
// Claude Code writes the content and Codex draws the images on their scheduled runs.
export function useSubmitJob() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (kind: JobKind, items: Array<NewsItem & { Section?: string }>) => {
    if (!items.length || isSubmitting) return false
    setIsSubmitting(true)
    setError(null)
    setSubmittedId(null)
    try {
      const res = await fetch('/api/content-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, items: toGenerationPayload(items) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || typeof json.job_id !== 'string') {
        setError(typeof json.error === 'string' ? json.error : 'Could not submit. Please try again.')
        return false
      }
      setSubmittedId(json.job_id)
      return true
    } catch {
      setError('Could not submit. Check your connection and try again.')
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting])

  const dismiss = useCallback(() => {
    setSubmittedId(null)
    setError(null)
  }, [])

  return { submit, isSubmitting, submittedId, error, dismiss }
}
