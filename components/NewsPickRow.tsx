'use client'
import { memo, useState } from 'react'
import { FeedItem } from '@/lib/types'
import { SOURCE_LABEL, imageSrcOf } from '@/lib/newsFeed'
import { ExternalLink } from 'lucide-react'

interface NewsPickRowProps {
  item: FeedItem
  checked: boolean
  onToggle: (id: string) => void
}

const SOURCE_COLOR: Record<FeedItem['source'], string> = {
  ai_news: 'bg-[--accent-purple]/15 text-[--accent-purple-mid]',
  investment_news: 'bg-[--accent-blue]/15 text-[--accent-blue-light]',
  job_hire_fire: 'bg-[--accent-amber]/15 text-[--accent-amber-light]',
}

// Compact selectable row — keeps a list of ~450 stories usable for picking newsletter items
function NewsPickRow({ item, checked, onToggle }: NewsPickRowProps) {
  const [imgError, setImgError] = useState(false)
  const src = imageSrcOf(item.Image)

  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        checked ? 'bg-[--accent-purple]/10 border-[--accent-purple]' : 'bg-[--bg-card] border-[--border-subtle] hover:border-[--border-elevated]'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.id)}
        className="mt-1 h-5 w-5 shrink-0 accent-[#7c3aed] cursor-pointer"
      />
      {src && !imgError ? (
        <img
          src={src}
          alt=""
          className="w-16 h-16 rounded-lg object-cover shrink-0 hidden sm:block"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-[--bg-elevated] shrink-0 hidden sm:flex items-center justify-center text-[--border-elevated] font-bold">
          #{item.Rank}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-semibold ${SOURCE_COLOR[item.source]}`}>
            {SOURCE_LABEL[item.source]}
          </span>
          <span className="uppercase tracking-wider text-[--text-muted]">{item.Topic}</span>
          <span className="text-[--text-muted]">#{item.Rank}</span>
        </div>
        <p className="text-[--text-primary] font-medium leading-snug line-clamp-2">{item.Title}</p>
        <a
          href={item.Link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm text-[--accent-blue] hover:text-blue-400"
        >
          Read more <ExternalLink size={14} />
        </a>
      </div>
    </label>
  )
}

export default memo(NewsPickRow)
