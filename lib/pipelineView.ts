import { NEWSLETTER_SECTIONS, SectionImage } from '@/lib/newsFeed'

// Pure helpers shared by the content pipeline server code and the Drafts page —
// no React, no Supabase, so they're unit-testable and safe on both sides.

export type JobKind = 'newsletter' | 'article'

// The exact image set each kind gets — one infographic per newsletter section, one hero per article
export const IMAGE_SECTION_KEYS: Record<JobKind, string[]> = {
  newsletter: ['world', 'tools', 'insights', 'trending'],
  article: ['hero'],
}

// section_key → the newsletter heading the image sits under (matches formats/newsletter.md)
export const SECTION_KEY_LABELS: Record<string, string> = {
  world: NEWSLETTER_SECTIONS[0],
  tools: NEWSLETTER_SECTIONS[1],
  insights: NEWSLETTER_SECTIONS[2],
  trending: NEWSLETTER_SECTIONS[3],
}

export interface ContentJob {
  id: string
  kind: JobKind
  items: Array<{ Title?: string; Section?: string }>
  status: 'pending' | 'writing' | 'written' | 'failed'
  content: string | null
  error: string | null
  created_at: string
}

export interface ImageJob {
  id: string
  job_id: string
  section_key: string
  title: string
  status: 'pending' | 'generating' | 'done' | 'failed'
  image_url: string | null
  error: string | null
}

export type StageTone = 'waiting' | 'working' | 'ready' | 'failed'
export interface JobStage {
  label: string
  tone: StageTone
  imagesDone: number
  imagesTotal: number
  canOpen: boolean
}

// One human-readable status per job, derived from the job row and its image rows
export function jobStage(job: ContentJob, images: ImageJob[]): JobStage {
  const imagesTotal = IMAGE_SECTION_KEYS[job.kind]?.length ?? 0
  const mine = images.filter(i => i.job_id === job.id)
  const imagesDone = mine.filter(i => i.status === 'done' && i.image_url).length
  const base = { imagesDone, imagesTotal }

  if (job.status === 'failed') return { ...base, label: `Failed: ${job.error ?? 'unknown error'}`, tone: 'failed', canOpen: false }
  if (job.status === 'pending') return { ...base, label: 'Waiting for Claude', tone: 'waiting', canOpen: false }
  if (job.status === 'writing') return { ...base, label: 'Claude is writing', tone: 'working', canOpen: false }

  // written — text is ready; images arrive on the Codex run
  if (imagesDone >= imagesTotal) return { ...base, label: 'Ready', tone: 'ready', canOpen: true }
  const failedImg = mine.find(i => i.status === 'failed')
  if (failedImg) {
    return { ...base, label: `Image failed (${imagesDone}/${imagesTotal}): ${failedImg.error ?? 'unknown error'}`, tone: 'failed', canOpen: true }
  }
  const generating = mine.some(i => i.status === 'generating')
  return {
    ...base,
    label: `${generating ? 'Codex is drawing' : 'Waiting for images'} ${imagesDone}/${imagesTotal}`,
    tone: generating ? 'working' : 'waiting',
    canOpen: true,
  }
}

// Finished images in the shape ContentModal / buildPostingBlocks expect, in canonical section order
export function toSectionImages(job: ContentJob, images: ImageJob[]): SectionImage[] {
  return (IMAGE_SECTION_KEYS[job.kind] ?? [])
    .map(key => images.find(i => i.job_id === job.id && i.section_key === key && i.status === 'done' && i.image_url))
    .filter((i): i is ImageJob & { image_url: string } => !!i)
    .map(i => ({ item: { Section: SECTION_KEY_LABELS[i.section_key] ?? i.title, Title: i.title }, src: i.image_url }))
}
