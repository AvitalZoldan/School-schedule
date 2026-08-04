import { useMemo, useState } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useAuditLog } from '../hooks/useAuditLog'
import { useEmployeesOverview } from '../hooks/useEmployees'
import { useClassesOverview } from '../hooks/useClasses'
import { DAY_PART_LABELS, type DayPart } from '../types/schedule'
import type { AuditLogWithUser } from '../types/audit'
import { addDays, parseISODate, toGregorianDateLabel, toISODate, toLocalTimeLabel } from '../lib/dateUtils'
import { ColumnFilter } from '../components/common/ColumnFilter'
import { Pagination } from '../components/common/Pagination'
import { useColumnFilters, matchesOption, matchesText } from '../hooks/useColumnFilters'
import { usePagination } from '../hooks/usePagination'

const PAGE_SIZE = 25

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
    detail,
  }
}

const FILTER_COLUMNS = ['date', 'class', 'action', 'detail', 'user'] as const

export default function History() {
  const schoolId = useCurrentSchoolId()
  const [dateFrom, setDateFrom] = useState(() => toISODate(addDays(new Date(), -30)))
  const [dateTo, setDateTo] = useState(() => toISODate(new Date()))
  const { filters } = useColumnFilters(FILTER_COLUMNS)

  const { data: entries, isLoading } = useAuditLog(schoolId, dateFrom, dateTo)
  const { data: employees } = useEmployeesOverview(schoolId)
  const { data: classes } = useClassesOverview(schoolId)

  const employeesById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e.full_name])), [employees])
  const classesById = useMemo(() => new Map((classes ?? []).map((c) => [c.id, c.name])), [classes])

  const employeeName = (id: number | null | undefined) =>
    id ? (employeesById.get(id) ?? `עובדת #${id}`) : '—'
  const className = (id: number | null | undefined) => (id ? (classesById.get(id) ?? `כיתה #${id}`) : '—')

  const rows = useMemo(() => (entries ?? []).map((entry) => buildRow(entry, employeeName)), [entries, employeesById])

  const classOptions = useMemo(
    () =>
      (classes ?? [])
        .filter((c) => c.active)
        .sort((a, b) => a.name.localeCompare(b.name, 'he'))
        .map((c) => ({ value: String(c.id), label: c.name })),
    [classes],
  )
  const actionOptions = useMemo(
    () => (Object.entries(ACTION_LABELS) as [AuditLogWithUser['action'], string][]).map(([value, label]) => ({ value, label })),
    [],
  )

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesText(filters.date.value, toGregorianDateLabel(parseISODate(row.date)))) return false

      const classValue = row.classId ? String(row.classId) : ''
      if (!matchesOption(filters.class.value, classValue)) return false
      if (!matchesText(filters.class.value, className(row.classId))) return false

      if (!matchesOption(filters.action.value, row.entry.action)) return false
      if (!matchesText(filters.action.value, ACTION_LABELS[row.entry.action])) return false

      if (!matchesText(filters.detail.value, row.detail)) return false

      if (!matchesText(filters.user.value, row.entry.changed_by_profile?.full_name ?? 'לא ידוע')) return false

      return true
    })
  }, [rows, filters])

  const { page, pageCount, setPage, pageItems: pagedRows } = usePagination(filteredRows, PAGE_SIZE)

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

      <div className="overflow-x-auto overflow-hidden rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[700px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f7f6f2] text-right text-[11.5px] text-ink-soft">
              <th className="border-b border-line px-3 py-2 font-medium">
                תאריך
                <ColumnFilter filter={filters.date} />
              </th>
              <th className="border-b border-line px-3 py-2 font-medium">שעה</th>
              <th className="border-b border-line px-3 py-2 font-medium">
                כיתה
                <ColumnFilter filter={filters.class} options={classOptions} />
              </th>
              <th className="border-b border-line px-3 py-2 font-medium">
                פעולה
                <ColumnFilter filter={filters.action} options={actionOptions} />
              </th>
              <th className="border-b border-line px-3 py-2 font-medium">
                פרטים
                <ColumnFilter filter={filters.detail} />
              </th>
              <th className="border-b border-line px-3 py-2 font-medium">
                משתמש
                <ColumnFilter filter={filters.user} />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink-soft">
                  אין שינויים רשומים בטווח/סינון שנבחרו.
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => (
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
              ))
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          totalItems={filteredRows.length}
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  )
}
