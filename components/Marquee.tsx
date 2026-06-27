'use client'

interface MarqueeItem {
  rank: number
  title: string
  topic?: string
}

interface MarqueeProps {
  items: MarqueeItem[]
}

export default function Marquee({ items }: MarqueeProps) {
  if (!items.length) return null
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <div className="inline-flex animate-marquee">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-6">
            <span className="text-[#7c3aed] font-bold text-xs">#{item.rank}</span>
            <span className="text-[#f1f5f9] text-sm">{item.title}</span>
            {item.topic && (
              <span className="text-[#94a3b8] text-xs uppercase tracking-wider">[{item.topic}]</span>
            )}
            <span className="text-[#1e293b] mx-2">·</span>
          </span>
        ))}
      </div>
    </div>
  )
}
