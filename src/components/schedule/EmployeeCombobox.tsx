import { useEffect, useMemo, useRef, useState } from 'react'
import type { EmployeeWithType } from '../../hooks/useEmployees'

const MIN_QUERY_LENGTH = 3

interface Props {
  employees: EmployeeWithType[]
  value: number | null
  onChange: (employeeId: number | null) => void
  placeholder?: string
}

// תיבת חיפוש-עובדת: הרשימה המסוננת/ממוינת מופיעה רק אחרי 3 תווים ומעלה,
// כדי להישאר שימושי גם עם רשימת עובדות ארוכה (במקום <select> ארוך מדי).
export function EmployeeCombobox({ employees, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = employees.find((e) => e.id === value) ?? null

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

  const trimmedQuery = query.trim()
  const showResults = trimmedQuery.length >= MIN_QUERY_LENGTH

  const results = useMemo(() => {
    if (!showResults) return []
    const q = trimmedQuery.toLowerCase()
    return employees
      .filter((e) => e.full_name.toLowerCase().includes(q))
      .sort((a, b) => {
        // התאמות שמתחילות באות שהוקלדה קודם, ואז שאר ההתאמות — לפי סדר א-ב
        const aStarts = a.full_name.toLowerCase().startsWith(q)
        const bStarts = b.full_name.toLowerCase().startsWith(q)
        if (aStarts !== bStarts) return aStarts ? -1 : 1
        return a.full_name.localeCompare(b.full_name, 'he')
      })
  }, [employees, trimmedQuery, showResults])

  function selectEmployee(id: number | null) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={open ? query : (selected?.full_name ?? '')}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        placeholder={placeholder ?? 'הקלידי שם עובדת…'}
        className="w-full rounded border border-line bg-white px-1.5 py-1 text-[12px]"
      />

      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-line bg-white shadow-md">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectEmployee(null)}
            className="block w-full px-2 py-1.5 text-right text-[12px] hover:bg-[#f2f0ea]"
          >
            — חור ריק —
          </button>

          {!showResults && trimmedQuery.length > 0 && (
            <div className="px-2 py-1.5 text-[11px] text-ink-soft">
              הקלידי עוד {MIN_QUERY_LENGTH - trimmedQuery.length} אות/יות לחיפוש…
            </div>
          )}

          {showResults && results.length === 0 && (
            <div className="px-2 py-1.5 text-[11px] text-ink-soft">לא נמצאו התאמות</div>
          )}

          {results.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectEmployee(emp.id)}
              className="block w-full px-2 py-1.5 text-right text-[12px] hover:bg-[#f2f0ea]"
            >
              {emp.full_name}
              {emp.employee_type ? ` (${emp.employee_type.label})` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
