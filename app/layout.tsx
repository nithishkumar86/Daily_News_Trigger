import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'News Webhook Tester',
  description: 'Receive and store news data from AI agents via webhook',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
