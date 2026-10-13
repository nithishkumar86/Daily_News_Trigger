import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import CleanupTrigger from '@/components/CleanupTrigger'

export const metadata: Metadata = {
  title: 'AI Digital Tamizha — Daily AI News',
  description: 'Your daily source for AI and investment intelligence',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'AI Tamizha',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-[--bg-primary] text-[--text-primary] min-h-screen antialiased">
        <CleanupTrigger />
        <Navbar />
        <main className="pt-[92px] lg:pt-16">
          {children}
        </main>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').then(function (registration) {
                    console.log('Service worker registered:', registration.scope);
                  }).catch(function (error) {
                    console.error('Service worker registration failed:', error);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
