'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'

// Multi-select over a live list, capped at `max`. Ids that disappear from the list
// (cleanup / realtime delete) are pruned so counts never include ghost items.
export function useSelection<T extends { id: string }>(items: T[], max: number) {
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setIds(prev => {
      const live = new Set(items.map(i => i.id))
      const next = new Set(Array.from(prev).filter(id => live.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [items])

  const toggle = useCallback((id: string) => {
    setIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < max) next.add(id)
      else return prev
      return next
    })
  }, [max])

  const addMany = useCallback((list: T[]) => {
    setIds(prev => {
      const next = new Set(prev)
      for (const item of list) {
        if (next.size >= max) break
        next.add(item.id)
      }
      return next
    })
  }, [max])

  const removeMany = useCallback((list: T[]) => {
    setIds(prev => {
      const next = new Set(prev)
      for (const item of list) next.delete(item.id)
      return next
    })
  }, [])

  const clear = useCallback(() => setIds(new Set()), [])

  const selected = useMemo(() => items.filter(i => ids.has(i.id)), [items, ids])

  return { ids, selected, atLimit: ids.size >= max, toggle, addMany, removeMany, clear }
}
