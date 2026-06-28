'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/latest', label: 'Latest' },
  { href: '/ai', label: 'AI' },
  { href: '/investment', label: 'Investment' },
]

export default function Navbar() {
  const pathname = usePathname()
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#0d0d1a] border-b border-[#1e293b] h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link href="/" className="flex flex-col">
          <span className="text-[#f1f5f9] font-bold text-base sm:text-xl leading-tight">AI Digital Tamizah</span>
          <span className="text-[#7c3aed] text-sm hidden sm:block">Daily AI News</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-6">
          {navLinks.map(link => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm sm:text-base font-medium transition-colors ${
                  isActive
                    ? 'text-[#7c3aed] border-b-2 border-[#7c3aed] pb-0.5'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
