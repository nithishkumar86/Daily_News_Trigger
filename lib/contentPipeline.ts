import { readFile } from 'fs/promises'
import path from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { IMAGE_BUCKET } from '@/lib/supabase'
import { NEWSLETTER_SECTIONS } from '@/lib/newsFeed'
import { IMAGE_SECTION_KEYS, JobKind } from '@/lib/pipelineView'

// Content pipeline: the manager submits picks (content_jobs) → the Claude Code
// routine claims a job, writes the content + image prompts (image_jobs) → Codex
// claims each image job, generates the image and uploads it. Every step is an
// atomic status transition, so no job or image is ever produced twice.

export const CONTENT_JOBS_TABLE = 'content_jobs'
export const IMAGE_JOBS_TABLE = 'image_jobs'

export type { JobKind }
export const JOB_KINDS: JobKind[] = ['newsletter', 'article']

// The exact image set each kind must get — one infographic per newsletter section, one hero per article
export const SECTION_KEYS = IMAGE_SECTION_KEYS

// A claim older than this is treated as abandoned (the run died) and can be re-claimed
export const STALE_CLAIM_MS = 30 * 60 * 1000

export const MAX_CONTENT_CHARS = 60_000
export const MAX_TITLE_CHARS = 120
export const MAX_PROMPT_CHARS = 8_000
export const MAX_ERROR_CHARS = 500
const LIST_LIMIT = 20

export type PipelineResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

const ok = <T>(data: T): PipelineResult<T> => ({ ok: true, data })
const fail = (error: string): PipelineResult<never> => ({ ok: false, error })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

const staleBefore = () => new Date(Date.now() - STALE_CLAIM_MS).toISOString()

// Rows that are free to claim: never claimed, or claimed by a run that died.
// The timestamp is double-quoted because PostgREST reserves "." and ":" inside or() values.
const claimableFilter = (claimedStatus: string) =>
  `status.eq.pending,and(status.eq.${claimedStatus},claimed_at.lt."${staleBefore()}")`

// ---------------------------------------------------------------------------
// Formats — the routine reads its instructions from /formats/ through the MCP
// ---------------------------------------------------------------------------

export const FORMAT_NAMES = ['newsletter', 'article', 'image-prompt'] as const
const formatCache = new Map<string, string>()

export async function getFormat(name: unknown): Promise<PipelineResult<{ name: string; content: string }>> {
  if (typeof name !== 'string' || !(FORMAT_NAMES as readonly string[]).includes(name)) {
    return fail(`Unknown format. Must be one of: ${FORMAT_NAMES.join(', ')}`)
  }
  if (!formatCache.has(name)) {
    try {
      formatCache.set(name, await readFile(path.join(process.cwd(), 'formats', `${name}.md`), 'utf8'))
    } catch {
      return fail(`Format file not found: ${name}.md`)
    }
  }
  return ok({ name, content: formatCache.get(name)! })
}

// ---------------------------------------------------------------------------
// Manager side — the app submits picks as a new pending job
// ---------------------------------------------------------------------------

// Same per-kind caps as /api/generate-content
export const MAX_JOB_ITEMS: Record<JobKind, number> = { newsletter: 30, article: 20 }

// Strip newlines (prompt delimiter injection) and cap length — mirrors generate-content's clean()
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, max)

export async function createContentJob(sb: SupabaseClient, body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid request body')
  const { kind, items } = body as Record<string, unknown>
  if (typeof kind !== 'string' || !(JOB_KINDS as string[]).includes(kind)) {
    return fail(`kind must be one of: ${JOB_KINDS.join(', ')}`)
  }
  const k = kind as JobKind
  if (!Array.isArray(items) || items.length === 0) return fail('items cannot be empty')
  if (items.length > MAX_JOB_ITEMS[k]) return fail(`Too many items. Maximum is ${MAX_JOB_ITEMS[k]}.`)

  const cleaned = []
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') return fail('each item must be an object')
    const i = raw as Record<string, unknown>
    const item: Record<string, unknown> = {
      Rank: Number(i.Rank) || 0,
      Date: clean(i.Date, 10),
      Title: clean(i.Title, 300),
      Topic: clean(i.Topic, 50),
      Summary: clean(i.Summary, 2000),
      Link: clean(i.Link, 500),
    }
    if (!item.Title) return fail('every item needs a Title')
    if (k === 'newsletter') {
      // Section drives which newsletter heading the story is written under
      const section = clean(i.Section, 60)
      if (!(NEWSLETTER_SECTIONS as readonly string[]).includes(section)) {
        return fail(`every newsletter item needs a Section: ${NEWSLETTER_SECTIONS.join(', ')}`)
      }
      item.Section = section
    }
    cleaned.push(item)
  }

  const { data, error } = await sb
    .from(CONTENT_JOBS_TABLE)
    .insert({ kind: k, items: cleaned })
    .select('id, status')
    .single()
  if (error) return fail(error.message)
  return ok({ job_id: data.id as string, status: data.status as string })
}

// ---------------------------------------------------------------------------
// Writer side (Claude Code routine)
// ---------------------------------------------------------------------------

export async function listPendingContentJobs(sb: SupabaseClient) {
  const { data, error } = await sb
    .from(CONTENT_JOBS_TABLE)
    .select('id, kind, created_at')
    .or(claimableFilter('writing'))
    .order('created_at', { ascending: true })
    .limit(LIST_LIMIT)
  if (error) return fail(error.message)
  return ok({ jobs: (data ?? []).map(j => ({ job_id: j.id, kind: j.kind, created_at: j.created_at })) })
}

export async function claimContentJob(sb: SupabaseClient, jobId: unknown) {
  if (!isUuid(jobId)) return fail('job_id must be a UUID')
  const { data, error } = await sb
    .from(CONTENT_JOBS_TABLE)
    .update({ status: 'writing', claimed_at: new Date().toISOString(), error: null })
    .eq('id', jobId)
    .or(claimableFilter('writing'))
    .select('id, kind, items')
    .maybeSingle()
  if (error) return fail(error.message)
  if (!data) return fail(await whyNotClaimable(sb, CONTENT_JOBS_TABLE, jobId))
  return ok({ job_id: data.id, kind: data.kind, items: data.items })
}

interface ImagePromptInput {
  section_key: string
  title: string
  prompt: string
}

function validateImagePrompts(kind: JobKind, raw: unknown): PipelineResult<ImagePromptInput[]> {
  if (!Array.isArray(raw)) return fail('image_prompts must be an array')
  const expected = SECTION_KEYS[kind]
  const seen = new Set<string>()
  const prompts: ImagePromptInput[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') return fail('each image prompt must be an object')
    const { section_key, title, prompt } = p as Record<string, unknown>
    if (typeof section_key !== 'string' || !expected.includes(section_key)) {
      return fail(`section_key must be one of: ${expected.join(', ')} for a ${kind}`)
    }
    if (seen.has(section_key)) return fail(`duplicate section_key: ${section_key}`)
    if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE_CHARS) {
      return fail(`title is required (max ${MAX_TITLE_CHARS} chars) for ${section_key}`)
    }
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
      return fail(`prompt is required (max ${MAX_PROMPT_CHARS} chars) for ${section_key}`)
    }
    seen.add(section_key)
    prompts.push({ section_key, title: title.trim(), prompt: prompt.trim() })
  }
  const missing = expected.filter(k => !seen.has(k))
  if (missing.length) return fail(`missing image prompts for: ${missing.join(', ')}`)
  return ok(prompts)
}

export async function submitContent(sb: SupabaseClient, jobId: unknown, content: unknown, imagePrompts: unknown) {
  if (!isUuid(jobId)) return fail('job_id must be a UUID')
  if (typeof content !== 'string' || !content.trim()) return fail('content is required')
  if (content.length > MAX_CONTENT_CHARS) return fail(`content is too long (max ${MAX_CONTENT_CHARS} chars)`)

  const { data: job, error: jobErr } = await sb
    .from(CONTENT_JOBS_TABLE)
    .select('id, kind, status')
    .eq('id', jobId)
    .maybeSingle()
  if (jobErr) return fail(jobErr.message)
  if (!job) return fail('job not found')
  // Only the run holding the claim may submit — a written job is never overwritten
  if (job.status !== 'writing') return fail(`job is ${job.status}; claim it first (only a writing job can be submitted)`)

  const prompts = validateImagePrompts(job.kind as JobKind, imagePrompts)
  if (!prompts.ok) return prompts

  // Images first: a retry after a failed status update re-inserts nothing (unique job_id+section_key)
  const { error: imgErr } = await sb
    .from(IMAGE_JOBS_TABLE)
    .upsert(
      prompts.data.map(p => ({ job_id: jobId, ...p })),
      { onConflict: 'job_id,section_key', ignoreDuplicates: true }
    )
  if (imgErr) return fail(imgErr.message)

  const { data: written, error: upErr } = await sb
    .from(CONTENT_JOBS_TABLE)
    .update({ status: 'written', content: content.trim(), error: null })
    .eq('id', jobId)
    .eq('status', 'writing')
    .select('id')
    .maybeSingle()
  if (upErr) return fail(upErr.message)
  if (!written) return fail('job changed state while submitting; nothing was overwritten')
  return ok({ job_id: jobId, status: 'written', image_jobs: prompts.data.map(p => p.section_key) })
}

export async function failContentJob(sb: SupabaseClient, jobId: unknown, reason: unknown) {
  if (!isUuid(jobId)) return fail('job_id must be a UUID')
  const msg = String(reason ?? 'unknown error').slice(0, MAX_ERROR_CHARS)
  const { data, error } = await sb
    .from(CONTENT_JOBS_TABLE)
    .update({ status: 'failed', error: msg })
    .eq('id', jobId)
    .in('status', ['pending', 'writing'])
    .select('id')
    .maybeSingle()
  if (error) return fail(error.message)
  if (!data) return fail('job not found or already finished')
  return ok({ job_id: jobId, status: 'failed' })
}

// ---------------------------------------------------------------------------
// Image side (Codex automation)
// ---------------------------------------------------------------------------

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // stays under Vercel's 4.5 MB request body limit
const MIN_IMAGE_BYTES = 1024

export async function listPendingImageJobs(sb: SupabaseClient) {
  const { data, error } = await sb
    .from(IMAGE_JOBS_TABLE)
    .select('id, job_id, section_key, title, created_at')
    .or(claimableFilter('generating'))
    .order('created_at', { ascending: true })
    .limit(LIST_LIMIT)
  if (error) return fail(error.message)
  return ok({
    image_jobs: (data ?? []).map(i => ({ image_job_id: i.id, job_id: i.job_id, section_key: i.section_key, title: i.title })),
  })
}

export async function claimImageJob(sb: SupabaseClient, imageJobId: unknown) {
  if (!isUuid(imageJobId)) return fail('image_job_id must be a UUID')
  const { data, error } = await sb
    .from(IMAGE_JOBS_TABLE)
    .update({ status: 'generating', claimed_at: new Date().toISOString(), error: null })
    .eq('id', imageJobId)
    .or(claimableFilter('generating'))
    .select('id, section_key, title, prompt')
    .maybeSingle()
  if (error) return fail(error.message)
  if (!data) return fail(await whyNotClaimable(sb, IMAGE_JOBS_TABLE, imageJobId))
  return ok({ image_job_id: data.id, section_key: data.section_key, title: data.title, prompt: data.prompt })
}

// Identify the image from its first bytes — the declared Content-Type is never trusted
export function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  const b = bytes
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF' &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP'
  ) return { mime: 'image/webp', ext: 'webp' }
  return null
}

export async function storeImage(sb: SupabaseClient, imageJobId: unknown, bytes: Uint8Array) {
  if (!isUuid(imageJobId)) return fail('image_job_id must be a UUID')
  if (bytes.length > MAX_IMAGE_BYTES) return fail(`image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB)`)
  if (bytes.length < MIN_IMAGE_BYTES) return fail('image is empty or too small')
  const kind = sniffImage(bytes)
  if (!kind) return fail('file is not a PNG, JPEG or WebP image')

  const { data: job, error: jobErr } = await sb
    .from(IMAGE_JOBS_TABLE)
    .select('id, job_id, section_key, status')
    .eq('id', imageJobId)
    .maybeSingle()
  if (jobErr) return fail(jobErr.message)
  if (!job) return fail('image job not found')
  // A done image is never replaced; an unclaimed one must be claimed first
  if (job.status !== 'generating') return fail(`image job is ${job.status}; claim it first (only a generating job accepts an image)`)

  const storagePath = `generated/${job.job_id}/${job.section_key}.${kind.ext}`
  const { error: upErr } = await sb.storage
    .from(IMAGE_BUCKET)
    .upload(storagePath, bytes, { contentType: kind.mime, upsert: true })
  if (upErr) return fail(upErr.message)
  const imageUrl = sb.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl

  const { data: done, error: doneErr } = await sb
    .from(IMAGE_JOBS_TABLE)
    .update({ status: 'done', image_url: imageUrl, error: null })
    .eq('id', imageJobId)
    .eq('status', 'generating')
    .select('id')
    .maybeSingle()
  if (doneErr) return fail(doneErr.message)
  if (!done) return fail('image job changed state while uploading')
  return ok({ image_job_id: imageJobId, status: 'done', image_url: imageUrl })
}

export async function failImageJob(sb: SupabaseClient, imageJobId: unknown, reason: unknown) {
  if (!isUuid(imageJobId)) return fail('image_job_id must be a UUID')
  const msg = String(reason ?? 'unknown error').slice(0, MAX_ERROR_CHARS)
  const { data, error } = await sb
    .from(IMAGE_JOBS_TABLE)
    .update({ status: 'failed', error: msg })
    .eq('id', imageJobId)
    .in('status', ['pending', 'generating'])
    .select('id')
    .maybeSingle()
  if (error) return fail(error.message)
  if (!data) return fail('image job not found or already finished')
  return ok({ image_job_id: imageJobId, status: 'failed' })
}

// Explains a refused claim so the agent knows to skip rather than retry
async function whyNotClaimable(sb: SupabaseClient, table: string, id: string): Promise<string> {
  const { data } = await sb.from(table).select('status').eq('id', id).maybeSingle()
  if (!data) return 'not found'
  if (data.status === 'writing' || data.status === 'generating') return 'already taken by another run — skip it'
  return `already ${data.status} — skip it`
}
