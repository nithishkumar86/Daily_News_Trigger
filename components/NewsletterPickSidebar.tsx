'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { FeedItem } from '@/lib/types'

export interface NewsletterPickSlot {
  key: string
  label: string
  shortLabel?: string
  items: FeedItem[]
  max: number
}

interface NewsletterPickSidebarProps {
  slots: NewsletterPickSlot[]
  activeKey: string
  onSelect: (key: string) => void
}

const SCROLL_STEP = 220

// Shows what's been ticked for each section, in order, and lets the manager jump back to change one.
// Every section lists all of its numbered positions (1..max): filled ones show the picked
// headline, the rest show an "Empty" placeholder, so the manager can see at a glance
// how many picks are left in each section.
// With 16 positions the list is taller than the screen, so it scrolls inside its own
// box with up/down buttons, and the active section is kept in view on every step change.
// On phones the full list would push the news below the fold, so it starts collapsed to a
// row of per-section progress chips with a Show/Hide toggle; on desktop it is always open.
export default function NewsletterPickSidebar({ slots, activeKey, onSelect }: NewsletterPickSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [canUp, setCanUp] = useState(false)
  const [canDown, setCanDown] = useState(false)
  const [open, setOpen] = useState(false)

  const totalPicked = slots.reduce((sum, s) => sum + s.items.length, 0)
  const totalMax = slots.reduce((sum, s) => sum + s.max, 0)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanUp(el.scrollTop > 4)
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [updateArrows])

  // Bring the active section's card into view inside the sidebar only (never scrolls the page).
  useEffect(() => {
    const el = scrollRef.current
    const card = cardRefs.current[activeKey]
    if (!el || !card) return
    el.scrollTo({ top: Math.max(0, card.offsetTop - 8), behavior: 'smooth' })
  }, [activeKey, open])

  const scrollBy = (dir: 1 | -1) => scrollRef.current?.scrollBy({ top: dir * SCROLL_STEP, behavior: 'smooth' })

  return (
    <div className="lg:sticky lg:top-20">
      <div className="flex items-center justify-between gap-2 px-1 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[--text-muted]">
          Your picks <span className="normal-case text-[--accent-purple-mid]">{totalPicked}/{totalMax}</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="lg:hidden flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[--border-subtle] bg-[--bg-card] text-xs font-medium text-[--accent-purple-light] hover:border-[--accent-purple] hover:bg-[--accent-purple]/20 transition-colors"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? 'Hide' : 'Show'}
          </button>
          <div className={`${open ? 'flex' : 'hidden'} lg:flex items-center gap-1`}>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canUp}
            aria-label="Scroll picks up"
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-[--border-subtle] bg-[--bg-card] text-[--accent-purple-light] hover:border-[--accent-purple] hover:bg-[--accent-purple]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[--border-subtle] disabled:hover:bg-[--bg-card]"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canDown}
            aria-label="Scroll picks down"
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-[--border-subtle] bg-[--bg-card] text-[--accent-purple-light] hover:border-[--accent-purple] hover:bg-[--accent-purple]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[--border-subtle] disabled:hover:bg-[--bg-card]"
          >
            <ChevronDown size={16} />
          </button>
          </div>
        </div>
      </div>

      {/* Phone, collapsed: one chip per section with its n/max — tap to jump to that section */}
      {!open && (
        <div className="lg:hidden flex flex-wrap gap-1.5 px-1">
          {slots.map(slot => {
            const active = activeKey === slot.key
            const full = slot.items.length >= slot.max
            return (
              <button
                key={slot.key}
                type="button"
                onClick={() => onSelect(slot.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                  active
                    ? 'border-[--accent-purple] bg-[--accent-purple]/15 text-[--text-primary]'
                    : 'border-[--border-subtle] bg-[--bg-card] text-[--text-muted]'
                }`}
              >
                {full && <Check size={12} className="text-[--accent-purple-mid]" />}
                {slot.shortLabel ?? slot.label}
                <span className={full ? 'text-[--accent-purple-light]' : 'text-[--text-subtle]'}>
                  {slot.items.length}/{slot.max}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className={`${open ? 'block' : 'hidden'} lg:block relative`}>
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="relative max-h-[55vh] lg:max-h-[calc(100vh-9rem)] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]"
        >
          <div className="flex flex-col gap-3">
            {slots.map((slot, slotIndex) => {
              const active = activeKey === slot.key
              const count = slot.items.length
              const full = count >= slot.max
              const positions = Array.from({ length: slot.max }, (_, i) => slot.items[i] ?? null)
              return (
                <button
                  key={slot.key}
                  ref={el => { cardRefs.current[slot.key] = el }}
                  onClick={() => onSelect(slot.key)}
                  className={`text-left rounded-xl border transition-all overflow-hidden ${
                    active
                      ? 'border-[--accent-purple] bg-[--accent-purple]/10 shadow-[0_0_0_1px_rgba(124,58,237,0.3)]'
                      : count > 0
                      ? 'border-[--border-subtle] bg-[--bg-card] hover:border-[--border-strong]'
                      : 'border-dashed border-[--border-subtle] bg-[--bg-primary] hover:border-[--border-strong]'
                  }`}
                >
                  {/* Section header: step number / tick, heading, n/max badge */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-xs font-bold ${
                          full ? 'bg-[--accent-purple] text-white' : active ? 'bg-[--accent-purple]/30 text-[--accent-purple-light]' : 'bg-[--border-subtle] text-[--text-muted]'
                        }`}
                      >
                        {full ? <Check size={13} /> : slotIndex + 1}
                      </span>
                      <span className="text-sm font-semibold text-[--text-primary] leading-tight">{slot.label}</span>
                    </span>
                    <span
                      className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        full
                          ? 'bg-[--accent-purple]/20 text-[--accent-purple-light]'
                          : count > 0
                          ? 'bg-[--border-subtle] text-[--accent-purple-mid]'
                          : 'bg-[--border-subtle] text-[--text-subtle]'
                      }`}
                    >
                      {count}/{slot.max}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mx-3 mt-2 h-1 rounded-full bg-[--border-subtle] overflow-hidden">
                    <div
                      className="h-full bg-[--accent-purple] transition-all"
                      style={{ width: `${(count / slot.max) * 100}%` }}
                    />
                  </div>

                  {/* Numbered list of positions */}
                  <ol className="px-3 py-2 divide-y divide-[--border-subtle]/70">
                    {positions.map((item, i) => (
                      <li key={item?.id ?? `empty-${i}`} className="flex items-start gap-2 py-1.5">
                        <span
                          className={`flex items-center justify-center w-5 h-5 mt-px rounded-md shrink-0 text-[11px] font-semibold ${
                            item ? 'bg-[--accent-purple]/20 text-[--accent-purple-light]' : 'border border-dashed border-[--border-strong] text-[--text-faint]'
                          }`}
                        >
                          {i + 1}
                        </span>
                        {item ? (
                          <span className="text-[13px] leading-snug text-[--text-soft] line-clamp-2">{item.Title}</span>
                        ) : (
                          <span className="text-[13px] leading-snug text-[--text-faint] italic">Empty</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </button>
              )
            })}
          </div>
        </div>

        {/* Fade hints that there is more above / below */}
        {canUp && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[--bg-primary] to-transparent rounded-t-xl" />
        )}
        {canDown && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[--bg-primary] to-transparent rounded-b-xl" />
        )}
      </div>

      {canDown && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          className={`${open ? 'flex' : 'hidden'} lg:flex mt-2 w-full items-center justify-center gap-1 py-1.5 rounded-lg border border-[--border-subtle] bg-[--bg-card] text-xs font-medium text-[--accent-purple-light] hover:border-[--accent-purple] hover:bg-[--accent-purple]/20 transition-colors`}
        >
          <ChevronDown size={14} /> More picks below
        </button>
      )}
    </div>
  )
}
