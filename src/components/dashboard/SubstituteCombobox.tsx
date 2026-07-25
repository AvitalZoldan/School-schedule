import { useEffect, useMemo, useRef, useState } from 'react'
import type { EmployeeWithType } from '../../hooks/useEmployees'
import type { SlotOccupancy } from '../../types/dashboard'

interface Props {
  employees: EmployeeWithType[]
  getOccupancy?: (employeeId: number) => SlotOccupancy | null
  onSelect: (employeeId: number) => void
}

// רשימת בחירת מ"מ לחור ריק (3.6-ב): מ"מ מועדפות מוצגות ראשונות (3.1).
// כל העובדות מופיעות, כולל כאלה שכבר משובצות באותו תאריך+חלק-יום במקום אחר (מסומנות בתגית) —
// בחירה בעובדת "תפוסה" לא נחסמת כאן; DashboardSlotCell מציג אישור העברה לפני שהשינוי נשמר.
export function SubstituteCombobox({ employees, getOccupancy, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? employees.filter((e) => e.full_name.toLowerCase().includes(q)) : employees
    return [...filtered].sort((a, b) => {
      const aSub = a.status === 'substitute'
      const bSub = b.status === 'substitute'
      if (aSub !== bSub) return aSub ? -1 : 1
      if (aSub && bSub && a.is_preferred !== b.is_preferred) return a.is_preferred ? -1 : 1
      return a.full_name.localeCompare(b.full_name, 'he')
    })
  }, [employees, query])

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder='שיבוץ מ"מ…'
        className="w-full rounded border border-line bg-white px-1.5 py-1 text-[12px]"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-line bg-white shadow-md">
          {sorted.length === 0 && (
            <div className="px-2 py-1.5 text-[11px] text-ink-soft">אין עובדת תואמת</div>
          )}
          {sorted.map((emp) => {
            const occupancy = getOccupancy?.(emp.id) ?? null
            return (
              <button
                key={emp.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(emp.id)
                  setQuery('')
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-right text-[12px] hover:bg-[#f2f0ea]"
              >
                <span>{emp.full_name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {occupancy && (
                    <span className="rounded bg-warn-soft px-1 text-[10px] text-warn">
                      משובצת: {occupancy.className}
                    </span>
                  )}
                  {emp.status === 'substitute' && emp.is_preferred && (
                    <span className="rounded bg-[#f3e9d2] px-1 text-[10px] text-gold">מועדפת</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
