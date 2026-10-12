'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase'
import { ContentJob, ImageJob } from '@/lib/pipelineView'

const JOB_LIMIT = 30
const JOB_COLUMNS = 'id, kind, items, status, content, error, created_at'
const IMAGE_COLUMNS = 'id, job_id, section_key, title, status, image_url, error'

// Loads the latest submitted jobs and their images (anon read-only) and
// live-reloads whenever the Claude routine or Codex updates a row.
export function useContentJobs() {
  const [jobs, setJobs] = useState<ContentJob[]>([])
  const [images, setImages] = useState<ImageJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seqRef = useRef(0)

  const load = useCallback(async () => {
    const seq = ++seqRef.current
    const supabase = getBrowserSupabase()
    const { data: jobRows, error: jobErr } = await supabase
      .from('content_jobs')
      .select(JOB_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(JOB_LIMIT)
    const ids = (jobRows ?? []).map(j => j.id)
    const { data: imageRows, error: imgErr } = ids.length
      ? await supabase.from('image_jobs').select(IMAGE_COLUMNS).in('job_id', ids)
      : { data: [], error: null }
    // A newer load started while this one was in flight — drop the stale result
    if (seq !== seqRef.current) return

    setError(jobErr || imgErr ? 'Could not load drafts' : null)
    setJobs((jobRows ?? []) as ContentJob[])
    setImages((imageRows ?? []) as ImageJob[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = getBrowserSupabase()
    // A submit writes the job and 1–4 image rows back to back — debounce into one reload
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleReload = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 600)
    }
    const ch = supabase
      .channel('drafts-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_jobs' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'image_jobs' }, scheduleReload)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(ch)
    }
  }, [load])

  return { jobs, images, loading, error, reload: load }
}
