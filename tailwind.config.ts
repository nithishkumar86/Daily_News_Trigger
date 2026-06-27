import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0d0d1a',
        'bg-card': '#13131f',
        'bg-elevated': '#1a1a2e',
        'accent-purple': '#7c3aed',
        'accent-blue': '#3b82f6',
        'text-primary': '#f1f5f9',
        'text-muted': '#94a3b8',
        'border-subtle': '#1e293b',
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
