import { useEffect, useRef } from 'react'

const LAST_ACTIVITY_KEY = 'app:last-activity'
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const
const CHECK_INTERVAL_MS = 10_000

// מנתקת אוטומטית לאחר X דקות בלי פעילות (נקבע ע"י מנהל מערכת ראשי, ראו useSystemSettings).
// "זמן פעילות אחרון" נשמר ב-localStorage כדי שפעילות בטאב אחד תאפס את הטיימר גם בטאבים
// אחרים של אותו דפדפן, ולא ינותקו בנפרד זה מזה.
export function useIdleLogout(timeoutMinutes: number | undefined, onIdle: () => void) {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return

    const timeoutMs = timeoutMinutes * 60_000
    const markActivity = () => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    markActivity()

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, markActivity)

    const interval = setInterval(() => {
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now())
      if (Date.now() - lastActivity >= timeoutMs) onIdleRef.current()
    }, CHECK_INTERVAL_MS)

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActivity)
      clearInterval(interval)
    }
  }, [timeoutMinutes])
}
