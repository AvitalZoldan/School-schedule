import { useEffect, useRef } from 'react'

// סוגר פופאובר בלחיצה מחוץ לאלמנט המצורף — כולל לחיצה על פתיחת פופאובר אחר באותו עמוד,
// כי גם היא "מחוץ" לפופאובר הנוכחי ולכן תיסגר קודם.
export function useClickOutside<T extends HTMLElement>(active: boolean, onOutside: () => void) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })

  return ref
}
