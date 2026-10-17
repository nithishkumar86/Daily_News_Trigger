'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

// Content tools — shown as a separate group in the center of the bar
const toolLinks = [
  { href: '/newsletter', label: 'Newsletter' },
  { href: '/article', label: 'Article' },
  { href: '/drafts', label: 'Drafts' },
]

const newsLinks = [
  { href: '/', label: 'Home' },
  { href: '/latest', label: 'Latest' },
  { href: '/ai', label: 'AI' },
  { href: '/investment', label: 'Invest' },
  { href: '/job', label: 'Jobs' },
  { href: '/realestate', label: 'Real Estate' },
]

function toolClass(active: boolean): string {
  return `inline-flex items-center min-h-[36px] px-4 rounded-full whitespace-nowrap text-sm lg:text-base font-medium border transition-colors ${
    active
      ? 'bg-[--accent-purple] border-[--accent-purple] text-white'
      : 'border-[--accent-purple]/50 text-[--accent-purple-light] hover:bg-[--accent-purple]/15'
  }`
}

function newsClass(active: boolean): string {
  return `inline-flex items-center min-h-[44px] whitespace-nowrap text-sm lg:text-base font-medium transition-colors ${
    active ? 'text-[--accent-purple] border-b-2 border-[--accent-purple] pb-0.5' : 'text-[--text-muted] hover:text-[--text-primary]'
  }`
}

function Brand() {
  return (
    <Link href="/" className="flex flex-col min-w-0">
      <span className="text-[--text-primary] font-bold text-base sm:text-xl leading-tight truncate">AI Digital Tamizha</span>
      <span className="text-[--accent-purple] text-sm hidden sm:block truncate">Daily AI News</span>
    </Link>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const stripRef = useRef<HTMLDivElement>(null)

  // On the mobile strip, keep the active link in view (e.g. /job is off-screen at 320px)
  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])

  const renderTools = () =>
    toolLinks.map(link => {
      const active = pathname === link.href
      return (
        <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={toolClass(active)}>
          {link.label}
        </Link>
      )
    })

  const renderNews = () =>
    newsLinks.map(link => {
      const active = pathname === link.href
      return (
        <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={newsClass(active)}>
          {link.label}
        </Link>
      )
    })

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[--bg-primary] border-b border-[--border-subtle] h-[92px] lg:h-16">
      {/* Desktop: brand left · tools center · news right */}
      <div className="hidden lg:grid grid-cols-[1fr_auto_1fr] items-center gap-6 max-w-7xl mx-auto px-4 h-full">
        <div className="justify-self-start min-w-0"><Brand /></div>
        <div className="flex items-center gap-3">{renderTools()}</div>
        <div className="justify-self-end flex items-center gap-6">
          {renderNews()}
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile/tablet: brand row + scrollable link strip */}
      <div className="lg:hidden flex flex-col h-full">
        <div className="flex-1 flex items-center justify-between px-4 min-w-0">
          <Brand />
          <ThemeToggle />
        </div>
        <div ref={stripRef} className="h-11 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-4 w-max h-full px-4">
            {renderTools()}
            <span className="w-px h-5 bg-[--border-subtle]" aria-hidden="true" />
            {renderNews()}
          </div>
        </div>
      </div>
    </nav>
  )
}
