import { useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useAuditLog } from '../hooks/useAuditLog'
import { useEmployeesOverview } from '../hooks/useEmployees'
import { useClassesOverview } from '../hooks/useClasses'
import { DAY_PART_LABELS, type DayPart } from '../types/schedule'
import type { AuditLogWithUser } from '../types/audit'
import { addDays, parseISODate, toGregorianDateLabel, toISODate, toLocalTimeLabel } from '../lib/dateUtils'

const ACTION_LABELS: Record<AuditLogWithUser['action'], string> = {
  create: 'יצירה',
  update: 'עדכון',
  delete: 'מחיקה',
}

const ACTION_CLASSES: Record<AuditLogWithUser['action'], string> = {
  create: 'bg-ok-soft text-ok',
  update: 'bg-accent-soft text-accent',
  delete: 'bg-danger-soft text-danger',
}

interface HistoryRow {
  entry: AuditLogWithUser
  date: string
  classId: number | null
  employeeIds: number[]
  detail: string
}

function buildRow(entry: AuditLogWithUser, employeeName: (id: number | null | undefined) => string): HistoryRow {
  if (entry.entity_type === 'daily_assignments') {
    const row = entry.new_value ?? entry.old_value!
    const dayPart = DAY_PART_LABELS[row.day_part_snapshot as DayPart] ?? row.day_part_snapshot
    const oldEmployeeId = entry.old_value?.employee_id ?? null
    const newEmployeeId = entry.new_value?.employee_id ?? null

    let detail: string
    if (entry.action === 'create') {
      detail = `שיבוץ מ"מ: ${employeeName(newEmployeeId)} — ${row.role_snapshot} (${dayPart})`
    } else if (entry.action === 'update') {
      detail = `${employeeName(oldEmployeeId)} ← ${employeeName(newEmployeeId)} — ${row.role_snapshot} (${dayPart})`
    } else {
      detail = `ביטול שיבוץ מ"מ: ${employeeName(oldEmployeeId)} — ${row.role_snapshot} (${dayPart})`
    }

    return {
      entry,
      date: row.assignment_date,
      classId: row.class_id_snapshot ?? null,
      employeeIds: [oldEmployeeId, newEmployeeId].filter((id): id is number => id != null),
      detail,
    }
  }

  // daily_absences
  const row = entry.new_value ?? entry.old_value!
  let detail: string
  if (entry.action === 'create') {
    detail = `סימון "לא הגיעה": ${employeeName(row.employee_id)}`
  } else if (entry.action === 'delete') {
    detail = `ביטול סימון "לא הגיעה": ${employeeName(row.employee_id)}`
  } else {
    detail = `עדכון היעדרות: ${employeeName(row.employee_id)}`
  }

  return {
    entry,
    date: row.absence_date,
    classId: null,
    employeeIds: row.employee_id != null ? [row.employee_id] : [],
    detail,
  }
}

// הסינון בפועל (ה-onChange כלפי ההורה) מופעל רק בבחירה מהרשימה — לא תוך כדי הקלדה. ה-draft
// המקומי משמש רק כדי לסנן את רשימת ההצעות המוצגת ולהציג את מה שהמשתמש מקליד.
function FilterCombobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
}) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => setDraft(value), [value])

  const filtered = useMemo(() => {
    const text = draft.trim().toLowerCase()
    const list = text ? options.filter((o) => o.toLowerCase().includes(text)) : options
    return list.slice(0, 20)
  }, [draft, options])

  return (
    <div className="relative w-44">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => {
            setOpen(false)
            if (draft.trim() === '') {
              onChange('')
            } else {
              setDraft(value)
            }
          }, 120)
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-accent"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {filtered.map((option) => (
            <li
              key={option}
              onMouseDown={(e) => {
                e.preventDefault()
                if (blurTimeout.current) clearTimeout(blurTimeout.current)
                setDraft(option)
                onChange(option)
                setOpen(false)
              }}
              className="cursor-pointer px-3 py-1.5 text-[13px] hover:bg-[#f2f0ea]"
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function History() {
  const schoolId = useCurrentSchoolId()
  const [dateFrom, setDateFrom] = useState(() => toISODate(addDays(new Date(), -30)))
  const [dateTo, setDateTo] = useState(() => toISODate(new Date()))
  const [classFilter, setClassFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')

  const { data: entries, isLoading } = useAuditLog(schoolId, dateFrom, dateTo)
  const { data: employees } = useEmployeesOverview(schoolId)
  const { data: classes } = useClassesOverview(schoolId)

  const employeesById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e.full_name])), [employees])
  const classesById = useMemo(() => new Map((classes ?? []).map((c) => [c.id, c.name])), [classes])

  const employeeName = (id: number | null | undefined) =>
    id ? (employeesById.get(id) ?? `עובדת #${id}`) : '—'
  const className = (id: number | null | undefined) => (id ? (classesById.get(id) ?? `כיתה #${id}`) : '—')

  const rows = useMemo(() => (entries ?? []).map((entry) => buildRow(entry, employeeName)), [entries, employeesById])

  const users = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of entries ?? []) {
      if (entry.changed_by) map.set(entry.changed_by, entry.changed_by_profile?.full_name ?? 'לא ידוע')
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [entries])

  const filteredRows = useMemo(() => {
    const classText = classFilter.trim().toLowerCase()
    const employeeText = employeeFilter.trim().toLowerCase()
    const userText = userFilter.trim().toLowerCase()
    return rows.filter((row) => {
      if (classText && !className(row.classId).toLowerCase().includes(classText)) return false
      if (employeeText && !row.employeeIds.some((id) => employeeName(id).toLowerCase().includes(employeeText))) return false
      if (userText && !(row.entry.changed_by_profile?.full_name ?? 'לא ידוע').toLowerCase().includes(userText)) return false
      return true
    })
  }, [rows, classFilter, employeeFilter, userFilter, employeesById, classesById])

  const sortedClasses = useMemo(() => [...(classes ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'he')), [classes])
  const sortedEmployees = useMemo(
    () => [...(employees ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name, 'he')),
    [employees],
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">היסטוריה</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] outline-none focus:border-accent"
          />
          <span className="text-ink-soft">עד</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => {
              setDateFrom(toISODate(addDays(new Date(), -30)))
              setDateTo(toISODate(new Date()))
            }}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] hover:bg-[#f2f0ea]"
          >
            30 יום אחרונים
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <FilterCombobox
          value={classFilter}
          onChange={setClassFilter}
          options={sortedClasses.map((c) => c.name)}
          placeholder="סינון לפי כיתה…"
        />
        <FilterCombobox
          value={employeeFilter}
          onChange={setEmployeeFilter}
          options={sortedEmployees.map((e) => e.full_name)}
          placeholder="סינון לפי עובדת…"
        />
        <FilterCombobox
          value={userFilter}
          onChange={setUserFilter}
          options={users.map(([, name]) => name)}
          placeholder="סינון לפי משתמש…"
        />
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-center text-ink-soft">טוען…</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-center text-ink-soft">
          אין שינויים רשומים בטווח/סינון שנבחרו.
        </div>
      ) : (
        <div className="overflow-x-auto overflow-hidden rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[700px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f6f2] text-right text-[11.5px] text-ink-soft">
                <th className="border-b border-line px-3 py-2 font-medium">תאריך</th>
                <th className="border-b border-line px-3 py-2 font-medium">שעה</th>
                <th className="border-b border-line px-3 py-2 font-medium">כיתה</th>
                <th className="border-b border-line px-3 py-2 font-medium">פעולה</th>
                <th className="border-b border-line px-3 py-2 font-medium">פרטים</th>
                <th className="border-b border-line px-3 py-2 font-medium">משתמש</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.entry.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{toGregorianDateLabel(parseISODate(row.date))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right" dir="ltr">
                    {toLocalTimeLabel(row.entry.changed_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{className(row.classId)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${ACTION_CLASSES[row.entry.action]}`}>
                      {ACTION_LABELS[row.entry.action]}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.detail}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.entry.changed_by_profile?.full_name ?? 'לא ידוע'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
