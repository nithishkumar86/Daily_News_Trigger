'use client'
import { useEffect } from 'react'

// Fires the lazy weekly cleanup check from any route (rendered once in the root
// layout). Deferred 500ms so it never competes with first-paint data fetches;
// failures are ignored because cleanup is best-effort background work.
export default function CleanupTrigger(): null {
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/api/check-cleanup').catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  return null
}
