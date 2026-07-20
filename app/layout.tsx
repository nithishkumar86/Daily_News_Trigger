import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import CleanupTrigger from '@/components/CleanupTrigger'

export const metadata: Metadata = {
  title: 'AI Digital Tamizah — Daily AI News',
  description: 'Your daily source for AI and investment intelligence',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0d0d1a] text-[#f1f5f9] min-h-screen antialiased">
        <CleanupTrigger />
        <Navbar />
        <main className="pt-16">
          {children}
        </main>
      </body>
    </html>
  )
}
