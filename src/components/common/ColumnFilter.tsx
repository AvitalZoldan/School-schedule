import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import type { ColumnFilterApi } from '../../hooks/useColumnFilters'

export type ColumnFilterOption = { value: string; label: string; color?: string }

const POPOVER_WIDTH = 208 // 13rem, תואם ל-w-52

// כפתור סינון ברמת עמודת טבלה: אייקון זכוכית מגדלת שבלחיצה פותח פופאובר עם חיפוש טקסט
// חופשי, ובעמודות עם ערכים קבועים (למשל תפקיד/קטגוריה/סטטוס) גם צ'קבוקסים לבחירת ערכים.
// שני מנגנוני הסינון (צ'קבוקסים + טקסט חופשי) פועלים יחד (AND) כדי לאפשר שילוב ביניהם.
// ה-state עצמו מנוהל ב-useColumnFilters (hooks/useColumnFilters.ts) — הקומפוננטה הזו רק מציגה
// ומפעילה אותו, כדי שאותה תשתית תשמש בכל טבלה מסוננת באפליקציה (עובדות, היסטוריה וכו').
//
// הפופאובר מוצג דרך portal ל-document.body עם position:fixed (במקום absolute בתוך ה-<th>):
// הטבלאות בהן משתמשים בקומפוננטה עטופות בדרך כלל בקונטיינר עם overflow-x-auto לצורך גלילה
// אופקית, וזה חותך (clip) כל תוכן שחורג מגבולות הקונטיינר — כולל פופאובר שנפתח בעמודה
// הראשונה/אחרונה, או פשוט נופל מתחת לגובה הטבלה הנראה. position:fixed מחוץ לקונטיינר פותר את זה.
export function ColumnFilter({
  filter,
  options,
  numeric = false,
  textPlaceholder = 'חיפוש חופשי…',
}: {
  filter: ColumnFilterApi
  options?: ColumnFilterOption[]
  numeric?: boolean
  textPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (popoverRef.current && !popoverRef.current.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    function updatePosition() {
      const rect = buttonRef.current!.getBoundingClientRect()
      const centered = rect.left + rect.width / 2 - POPOVER_WIDTH / 2
      const left = Math.min(Math.max(8, centered), window.innerWidth - POPOVER_WIDTH - 8)
      setPosition({ top: rect.bottom + 4, left })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  return (
    <span className="relative inline-block font-normal">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="סינון"
        className="relative mr-1 rounded p-0.5 align-middle text-accent transition-colors hover:bg-[#e5e2da]"
      >
        <Search size={13} />
        {filter.isActive && <span className="absolute -left-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />}
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-50 rounded-lg border border-line bg-panel p-2 text-start shadow-lg"
            style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
          >
            {options && options.length > 0 && (
              <div className="mb-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
                {options.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-[12.5px] font-normal text-ink">
                    <input
                      type="checkbox"
                      checked={filter.value.selected.includes(opt.value)}
                      onChange={() => filter.toggleOption(opt.value)}
                    />
                    {opt.color && (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />
                    )}
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
            {numeric ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={filter.value.min}
                  onChange={(e) => filter.setMin(e.target.value)}
                  placeholder="מ-"
                  className="w-0 min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-[12.5px] font-normal outline-none focus:border-accent"
                />
                <span className="text-[12px] text-ink-soft">עד</span>
                <input
                  type="number"
                  value={filter.value.max}
                  onChange={(e) => filter.setMax(e.target.value)}
                  placeholder="עד"
                  className="w-0 min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-[12.5px] font-normal outline-none focus:border-accent"
                />
              </div>
            ) : (
              <input
                type="text"
                value={filter.value.text}
                onChange={(e) => filter.setText(e.target.value)}
                placeholder={textPlaceholder}
                className="w-full rounded-md border border-line bg-white px-2 py-1 text-[12.5px] font-normal outline-none focus:border-accent"
              />
            )}
            {filter.isActive && (
              <button
                type="button"
                onClick={filter.clear}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-line px-2 py-1 text-[12px] font-normal text-ink-soft hover:bg-[#f2f0ea]"
              >
                <X size={12} />
                ניקוי סינון
              </button>
            )}
          </div>,
          document.body,
        )}
    </span>
  )
}
