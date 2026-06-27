'use client'
import { NewsItem } from '@/lib/types'
import { ExternalLink } from 'lucide-react'

interface NewsCardProps {
  item: NewsItem
  checked: boolean
  onToggle: (id: string) => void
}

export default function NewsCard({ item, checked, onToggle }: NewsCardProps) {
  const imageSrc = item.image
    ? item.image.startsWith('data:')
      ? item.image
      : `data:image/jpeg;base64,${item.image}`
    : null

  return (
    <div
      className={`bg-[#13131f] border rounded-xl overflow-hidden transition-all ${
        checked ? 'border-[#7c3aed] shadow-lg shadow-purple-900/20' : 'border-[#1e293b]'
      }`}
    >
      {/* Image */}
      <div className="relative h-48">
        {imageSrc ? (
          <img src={imageSrc} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] flex items-center justify-center">
            <span className="text-[#1e293b] text-4xl font-bold">#{item.rank}</span>
          </div>
        )}
        <span className="absolute top-2 left-2 bg-[#7c3aed] text-white text-xs font-bold px-2 py-0.5 rounded-full">
          #{item.rank}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium bg-[#7c3aed]/10 text-[#7c3aed] px-2 py-0.5 rounded-full uppercase tracking-wider">
            {item.topic}
          </span>
          <span className="text-xs text-[#94a3b8]">{item.date}</span>
        </div>
        <h3 className="text-[#f1f5f9] font-semibold text-sm leading-snug line-clamp-2">{item.title}</h3>
        <p className="text-[#94a3b8] text-xs leading-relaxed line-clamp-4">{item.summary}</p>
        <div className="flex items-center justify-between pt-1">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#3b82f6] hover:text-blue-400 transition-colors"
          >
            Read more <ExternalLink size={10} />
          </a>
          <button
            onClick={() => onToggle(item.id)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-all ${
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
