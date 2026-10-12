import { formatDateLabel } from '@/lib/newsFeed'

interface DateGroupHeaderProps {
  date: string
  latestDate: string
  count: number
  action?: React.ReactNode
}

export default function DateGroupHeader({ date, latestDate, count, action }: DateGroupHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#1e293b] pb-2">
      <h2 className="text-[#f1f5f9] text-base sm:text-lg font-semibold">
        {formatDateLabel(date, latestDate)}
        <span className="ml-2 text-[#94a3b8] text-sm font-normal">({count})</span>
      </h2>
      {action}
    </div>
  )
}
