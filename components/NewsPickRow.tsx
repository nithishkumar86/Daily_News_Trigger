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
  ai_news: 'bg-[#7c3aed]/15 text-[#a78bfa]',
  investment_news: 'bg-[#3b82f6]/15 text-[#60a5fa]',
  job_hire_fire: 'bg-[#f59e0b]/15 text-[#fbbf24]',
}

// Compact selectable row — keeps a list of ~450 stories usable for picking newsletter items
function NewsPickRow({ item, checked, onToggle }: NewsPickRowProps) {
  const [imgError, setImgError] = useState(false)
  const src = imageSrcOf(item.Image)

  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        checked ? 'bg-[#7c3aed]/10 border-[#7c3aed]' : 'bg-[#13131f] border-[#1e293b] hover:border-[#2d2d4e]'
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
        <div className="w-16 h-16 rounded-lg bg-[#1a1a2e] shrink-0 hidden sm:flex items-center justify-center text-[#2d2d4e] font-bold">
          #{item.Rank}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-semibold ${SOURCE_COLOR[item.source]}`}>
            {SOURCE_LABEL[item.source]}
          </span>
          <span className="uppercase tracking-wider text-[#94a3b8]">{item.Topic}</span>
          <span className="text-[#94a3b8]">#{item.Rank}</span>
        </div>
        <p className="text-[#f1f5f9] font-medium leading-snug line-clamp-2">{item.Title}</p>
        <a
          href={item.Link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm text-[#3b82f6] hover:text-blue-400"
        >
          Read more <ExternalLink size={14} />
        </a>
      </div>
    </label>
  )
}

export default memo(NewsPickRow)
