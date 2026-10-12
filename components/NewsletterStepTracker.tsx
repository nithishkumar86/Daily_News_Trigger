'use client'
import { Check } from 'lucide-react'

export interface NewsletterStep {
  key: string
  shortLabel: string
}

interface NewsletterStepTrackerProps {
  steps: NewsletterStep[]
  activeKey: string
  doneKeys: Set<string>
  onSelect: (key: string) => void
}

// Horizontal progress line — tap any step to review or change that pick.
// Scrolls horizontally on narrow screens instead of wrapping.
export default function NewsletterStepTracker({ steps, activeKey, doneKeys, onSelect }: NewsletterStepTrackerProps) {
  return (
    <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
      <div className="flex items-center w-max min-w-full sm:min-w-0 sm:w-full">
        {steps.map((step, i) => {
          const done = doneKeys.has(step.key)
          const active = activeKey === step.key
          return (
            <div key={step.key} className="flex items-center flex-1">
              <button
                onClick={() => onSelect(step.key)}
                className="flex flex-col items-center gap-1.5 px-1 shrink-0"
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold border-2 transition-all ${
                    done
                      ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                      : active
                      ? 'border-[#7c3aed] text-[#a78bfa] bg-[#7c3aed]/10'
                      : 'border-[#1e293b] text-[#94a3b8] bg-[#13131f]'
                  }`}
                >
                  {done ? <Check size={16} /> : i + 1}
                </span>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    active ? 'text-[#f1f5f9]' : 'text-[#94a3b8]'
                  }`}
                >
                  {step.shortLabel}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 min-w-[24px] mx-1 ${done ? 'bg-[#7c3aed]' : 'bg-[#1e293b]'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
