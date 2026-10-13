import { formatDateLabel } from '@/lib/newsFeed'

interface DateGroupHeaderProps {
  date: string
  latestDate: string
  count: number
  action?: React.ReactNode
}

export default function DateGroupHeader({ date, latestDate, count, action }: DateGroupHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[--border-subtle] pb-2">
      <h2 className="text-[--text-primary] text-base sm:text-lg font-semibold">
        {formatDateLabel(date, latestDate)}
        <span className="ml-2 text-[--text-muted] text-sm font-normal">({count})</span>
      </h2>
      {action}
    </div>
  )
}
