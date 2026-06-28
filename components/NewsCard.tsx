'use client'
import { NewsItem } from '@/lib/types'
import { ExternalLink } from 'lucide-react'

interface NewsCardProps {
  item: NewsItem
  checked: boolean
  onToggle: (id: string) => void
}

export default function NewsCard({ item, checked, onToggle }: NewsCardProps) {
  const imageSrc = item.Image && !item.Image.startsWith('http')
    ? item.Image.startsWith('data:')
      ? item.Image
      : `data:image/jpeg;base64,${item.Image}`
    : null

  return (
    <div
      className={`bg-[#13131f] border rounded-xl overflow-hidden transition-all ${
        checked ? 'border-[#7c3aed] shadow-lg shadow-purple-900/20' : 'border-[#1e293b]'
      }`}
    >
      {/* Image */}
      <div className="relative h-72 sm:h-96">
        {imageSrc ? (
          <img src={imageSrc} alt={item.Title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] flex items-center justify-center">
            <span className="text-[#2d2d4e] text-6xl font-bold">#{item.Rank}</span>
          </div>
        )}
        <span className="absolute top-3 left-3 bg-[#7c3aed] text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
          #{item.Rank}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium bg-[#7c3aed]/10 text-[#7c3aed] px-3 py-1 rounded-full uppercase tracking-wider">
            {item.Topic}
          </span>
          <span className="text-sm text-[#94a3b8]">{item.Date}</span>
        </div>
        <h3 className="text-[#f1f5f9] font-semibold text-xl leading-snug line-clamp-3">{item.Title}</h3>
        <p className="text-[#94a3b8] text-base leading-relaxed line-clamp-6">{item.Summary}</p>
        <div className="flex items-center justify-between pt-1">
          <a
            href={item.Link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-[#3b82f6] hover:text-blue-400 transition-colors"
          >
            Read more <ExternalLink size={13} />
          </a>
          <button
            onClick={() => onToggle(item.id)}
            className={`flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-full border transition-all ${
              checked
                ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                : 'border-[#1e293b] text-[#94a3b8] hover:border-[#7c3aed] hover:text-[#7c3aed]'
            }`}
          >
            {checked ? '✓ Selected' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  )
}
