'use client'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { FileText, Mail } from 'lucide-react'
import { useContentJobs } from '@/lib/useContentJobs'
import { ContentJob, jobStage, StageTone, toSectionImages } from '@/lib/pipelineView'

const ContentModal = dynamic(() => import('@/components/ContentModal'), { ssr: false })

const SKELETON_KEYS = [0, 1, 2]

const TONE_CLASS: Record<StageTone, string> = {
  waiting: 'bg-[#1e293b] text-[#94a3b8]',
  working: 'bg-amber-400/15 text-amber-300',
  ready: 'bg-emerald-400/15 text-emerald-300',
  failed: 'bg-red-400/15 text-red-300',
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// Everything the manager submitted, with live progress: Claude writes the text on
// the morning routine, Codex adds the images, then the full copy opens here.
export default function DraftsPage() {
  const { jobs, images, loading, error } = useContentJobs()
  const [openId, setOpenId] = useState<string | null>(null)

  const openJob = jobs.find(j => j.id === openId) ?? null
  const openImages = useMemo(() => (openJob ? toSectionImages(openJob, images) : []), [openJob, images])
  const openStage = openJob ? jobStage(openJob, images) : null

  return (
    <div className="min-h-screen bg-[#0d0d1a] pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 pt-4">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#f1f5f9]">Drafts</h1>
          <p className="text-[#94a3b8] mt-1 text-sm sm:text-base">
            Newsletters and articles you submitted. Claude writes them on the morning run, Codex then creates the
            images, and the full copy opens here, ready to post.
          </p>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <div className="flex flex-col gap-3">
            {SKELETON_KEYS.map(i => (
              <div key={i} className="bg-[#13131f] border border-[#1e293b] rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#94a3b8] text-center">
            <div className="text-5xl mb-4" aria-hidden="true">🗂️</div>
            <p className="text-lg font-medium text-[#f1f5f9]">Nothing submitted yet.</p>
            <p className="text-sm mt-2">
              Pick stories on the <Link href="/newsletter" className="text-[#a78bfa] hover:underline">Newsletter</Link> or{' '}
              <Link href="/article" className="text-[#a78bfa] hover:underline">Article</Link> page and press Submit.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map(job => (
              <DraftCard key={job.id} job={job} stage={jobStage(job, images)} thumbs={toSectionImages(job, images).map(i => i.src)} onOpen={() => setOpenId(job.id)} />
            ))}
          </ul>
        )}
      </div>

      {openJob && (
        <ContentModal
          isOpen
          onClose={() => setOpenId(null)}
          content={openJob.content ?? ''}
          isGenerating={false}
          selectedItems={[]}
          format={openJob.kind}
          generatedImages={openImages}
          withCta={openJob.kind === 'newsletter'}
          notice={
            openStage && openStage.imagesDone < openStage.imagesTotal
              ? `Images ready: ${openStage.imagesDone} of ${openStage.imagesTotal}. The rest appear here automatically after the Codex run.`
              : undefined
          }
        />
      )}
    </div>
  )
}

interface DraftCardProps {
  job: ContentJob
  stage: ReturnType<typeof jobStage>
  thumbs: string[]
  onOpen: () => void
}

function DraftCard({ job, stage, thumbs, onOpen }: DraftCardProps) {
  const Icon = job.kind === 'newsletter' ? Mail : FileText
  const titles = job.items.map(i => i.Title).filter(Boolean) as string[]

  return (
    <li className="bg-[#13131f] border border-[#1e293b] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#7c3aed]/15 text-[#c4b5fd] shrink-0">
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[#f1f5f9] font-semibold capitalize">{job.kind}</p>
            <p className="text-xs text-[#64748b]">
              {formatWhen(job.created_at)} · {job.items.length} {job.items.length === 1 ? 'story' : 'stories'}
            </p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full max-w-full break-words ${TONE_CLASS[stage.tone]}`}>
          {stage.label}
        </span>
      </div>

      {titles.length > 0 && (
        <p className="text-sm text-[#94a3b8] line-clamp-2">
          {titles.slice(0, 3).join(' · ')}
          {titles.length > 3 && ` · +${titles.length - 3} more`}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {Array.from({ length: stage.imagesTotal }, (_, i) =>
            thumbs[i] ? (
              <img key={i} src={thumbs[i]} alt="" className="w-16 h-10 object-cover rounded-md border border-[#1e293b]" />
            ) : (
              <span key={i} className="w-16 h-10 rounded-md border border-dashed border-[#334155]" aria-hidden="true" />
            )
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          disabled={!stage.canOpen}
          className="min-h-[44px] px-5 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {stage.tone === 'ready' ? 'Open copy →' : 'Preview →'}
        </button>
      </div>
    </li>
  )
}
