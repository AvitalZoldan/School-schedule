import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { EmployeeWithType } from '../../hooks/useEmployees'

interface Props {
  employee: EmployeeWithType | null | undefined
  children: ReactNode
}

// עוטף כל הופעה של שם עובדת (בכל טבלה/רשת באפליקציה) בטולטיפ ריחוף גנרי: כפתור קטן בלבד
// שקופץ למסך "רשימת עובדות" עם שם העובדת מוזרק לשדה החיפוש שם (ראו Employees.tsx). בלי
// employee (למשל "חור ריק"/"לא מאויש") מוצג רק ה-children כרגיל, בלי שום עטיפה.
//
// הטולטיפ מוצג ב-portal ל-document.body (position: fixed לפי getBoundingClientRect של הטריגר),
// לא כ-absolute רגיל בתוך ה-DOM המקומי — כי רוב מוקדי השימוש (תאי דשבורד/שיבוץ בסיסי/פתיחה)
// יושבים בתוך div עם overflow-hidden (truncate), שהיה חותך כל פופ-אובר absolute רגיל.
//
// הטריגר הפנימי ("מעבר לפרטי עובדת") הוא span עם role="button" ולא <button> אמיתי: הרבה מוקדי
// שימוש (SlotCell/DashboardSlotCell/AuxiliaryCell) כבר מציגים את השם בתוך <button> שפותח פופ-אובר
// שיבוץ — button מקונן בתוך button הוא HTML לא תקין, ולכן משתמשים ב-span+stopPropagation במקום.
export function EmployeeHoverCard({ employee, children }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number; openAbove: boolean } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function close() {
      setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (!employee) return <>{children}</>

  function show() {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const openAbove = rect.bottom + 60 > window.innerHeight
      setPos({
        top: openAbove ? rect.top - 4 : rect.bottom + 4,
        right: window.innerWidth - rect.right,
        openAbove,
      })
    }
    setOpen(true)
  }

  function scheduleHide() {
    closeTimeout.current = setTimeout(() => setOpen(false), 150)
  }

  function goToEmployee(e: React.SyntheticEvent) {
    e.stopPropagation()
    setOpen(false)
    navigate(`/staff?search=${encodeURIComponent(employee!.full_name)}`)
  }

  return (
    <span ref={triggerRef} className="relative" onMouseEnter={show} onMouseLeave={scheduleHide}>
      {children}
      {open &&
        pos &&
        createPortal(
          <div
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            style={{
              position: 'fixed',
              top: pos.openAbove ? undefined : pos.top,
              bottom: pos.openAbove ? window.innerHeight - pos.top : undefined,
              right: pos.right,
            }}
            className="z-50 rounded-lg border border-line bg-panel p-1 shadow-lg"
          >
            <span
              role="button"
              tabIndex={0}
              onClick={goToEmployee}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && goToEmployee(e)}
              className="block cursor-pointer whitespace-nowrap rounded-md bg-accent px-2.5 py-1.5 text-center text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              מעבר לפרטי עובדת ←
            </span>
          </div>,
          document.body,
        )}
    </span>
  )
}
