import { useMemo, useState } from 'react'
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

function describeEntry(
  entry: AuditLogWithUser,
  employeeName: (id: number | null | undefined) => string,
  className: (id: number | null | undefined) => string,
): string {
  if (entry.entity_type === 'daily_assignments') {
    const row = entry.new_value ?? entry.old_value!
    const cls = className(row.class_id_snapshot)
    const dayPart = DAY_PART_LABELS[row.day_part_snapshot as DayPart] ?? row.day_part_snapshot
    const dateLabel = toGregorianDateLabel(parseISODate(row.assignment_date))
    const location = `כיתה ${cls}, ${row.role_snapshot} (${dayPart}), ${dateLabel}`

    if (entry.action === 'create') {
      return `שיבוץ מ"מ: ${employeeName(entry.new_value?.employee_id)} — ${location}`
    }
    if (entry.action === 'update') {
      return `עדכון שיבוץ מ"מ ב${location}: ${employeeName(entry.old_value?.employee_id)} ← ${employeeName(entry.new_value?.employee_id)}`
    }
    return `ביטול שיבוץ מ"מ: ${employeeName(entry.old_value?.employee_id)} — ${location}`
  }

  // daily_absences
  const row = entry.new_value ?? entry.old_value!
  const dateLabel = toGregorianDateLabel(parseISODate(row.absence_date))
  if (entry.action === 'create') {
    return `סימון "לא הגיעה": ${employeeName(row.employee_id)}, ${dateLabel}`
  }
  if (entry.action === 'delete') {
    return `ביטול סימון "לא הגיעה": ${employeeName(row.employee_id)}, ${dateLabel}`
  }
  return `עדכון היעדרות: ${employeeName(row.employee_id)}, ${dateLabel}`
}

// לשונית "היסטוריה" — יומן שינויים לדשבורד ולמסך קייטנה (שתיהן משתמשות באותן טבלאות/hooks,
// ראו migration log_audit_event): שיבוצי מ"מ יומיים והיעדרויות. מציג רק שינויים מהיום שהטריגר
// הופעל והלאה — אין תיעוד רטרואקטיבי לשינויים שקרו לפני כן.
export default function History() {
  const schoolId = useCurrentSchoolId()
  const [date, setDate] = useState(() => toISODate(new Date()))

  const { data: entries, isLoading } = useAuditLog(schoolId, date)
  const { data: employees } = useEmployeesOverview(schoolId)
  const { data: classes } = useClassesOverview(schoolId)

  const employeesById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e.full_name])), [employees])
  const classesById = useMemo(() => new Map((classes ?? []).map((c) => [c.id, c.name])), [classes])

  const employeeName = (id: number | null | undefined) =>
    id ? (employeesById.get(id) ?? `עובדת #${id}`) : '—'
  const className = (id: number | null | undefined) => (id ? (classesById.get(id) ?? `כיתה #${id}`) : '—')

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">היסטוריה</h1>
          <div className="mt-1 text-[13px] text-ink-soft">
            יומן שינויים בשיבוץ מ"מ יומי ובהיעדרויות — בדשבורד ובמסכי הקייטנות. מתעד מהיום שהמעקב
            הופעל והלאה בלבד.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((d) => toISODate(addDays(parseISODate(d), -1)))}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] hover:bg-[#f2f0ea]"
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setDate((d) => toISODate(addDays(parseISODate(d), 1)))}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] hover:bg-[#f2f0ea]"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setDate(toISODate(new Date()))}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] hover:bg-[#f2f0ea]"
          >
            היום
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel">
        {isLoading ? (
          <div className="p-[18px] text-center text-ink-soft">טוען…</div>
        ) : entries && entries.length > 0 ? (
          <div className="flex flex-col">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 border-t border-line px-3 py-2.5 text-[13px] first:border-t-0">
                <div className="w-12 shrink-0 text-[12px] text-ink-soft" dir="ltr">
                  {toLocalTimeLabel(entry.changed_at)}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${ACTION_CLASSES[entry.action]}`}>
                  {ACTION_LABELS[entry.action]}
                </span>
                <div className="min-w-0 flex-1">{describeEntry(entry, employeeName, className)}</div>
                <div className="shrink-0 text-[12px] text-ink-soft">
                  {entry.changed_by_profile?.full_name ?? 'לא ידוע'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-[18px] text-center text-ink-soft">אין שינויים רשומים בתאריך זה.</div>
        )}
      </div>
    </div>
  )
}
