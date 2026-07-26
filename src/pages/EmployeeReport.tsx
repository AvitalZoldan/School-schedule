import { useMemo, useState } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useEmployees } from '../hooks/useEmployees'
import { useDashboardData, type DashboardClassData } from '../hooks/useDashboard'
import { addDays, parseISODate, systemWeekday, toHebrewDateLabel, toISODate, weekDates } from '../lib/dateUtils'
import { buildResolveContext, resolveSlotStatus } from '../lib/resolveDashboard'
import { DAY_PART_LABELS, WEEKDAY_LABELS } from '../types/schedule'
import type { DayPart, TemplateSlotWithEmployee } from '../types/schedule'

const FRIDAY_WEEKDAY = Object.entries(WEEKDAY_LABELS).find(([, label]) => label === 'שישי')?.[0]
const FRIDAY_WD = FRIDAY_WEEKDAY !== undefined ? Number(FRIDAY_WEEKDAY) : undefined

type RowKind = 'permanent' | 'sub' | 'leave_sub' | 'absent' | 'leave'

type ReportDayPart = DayPart | 'long'

interface ReportRow {
  date: string
  weekday: number
  className: string
  dayPart: ReportDayPart
  kind: RowKind
}

const DAY_PART_REPORT_LABELS: Record<ReportDayPart, string> = {
  ...DAY_PART_LABELS,
  long: 'ארוך',
}

// כל שורה מסומנת בפס צבע לפי הסטטוס (עבדה קבועה/מ"מ/נעדרה/בחופשה) — בלי עמודת טקסט נוספת,
// כדי לשמור על 3 העמודות המבוקשות (תאריך/כיתה/חלק יום) בלבד
const KIND_ROW_CLASS: Record<RowKind, string> = {
  permanent: 'border-r-4 border-[#1d4ed8]',
  sub: 'border-r-4 border-ok',
  leave_sub: 'border-r-4 border-ok',
  absent: 'border-r-4 border-danger',
  leave: 'border-r-4 border-ink-soft',
}

function dateRange(start: string, end: string): string[] {
  const result: string[] = []
  let d = parseISODate(start)
  const endD = parseISODate(end)
  while (d <= endD) {
    result.push(toISODate(d))
    d = addDays(d, 1)
  }
  return result
}

export default function EmployeeReport() {
  const schoolId = useCurrentSchoolId()
  const { data: allEmployees } = useEmployees(schoolId)

  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const defaultWeek = useMemo(() => weekDates(new Date()), [])
  const [startDate, setStartDate] = useState(defaultWeek[0])
  const [endDate, setEndDate] = useState(defaultWeek[defaultWeek.length - 1])
  const [showClass, setShowClass] = useState(true)

  const { data, isLoading } = useDashboardData(schoolId, startDate, endDate)

  const ctx = useMemo(
    () => (data ? buildResolveContext(data.absences, data.leaves, data.dailyAssignments) : null),
    [data],
  )

  // חתוכים מראש לפי יום בשבוע פעם אחת, כדי שלולאת התאריכים לא תסרוק את כל השיבוצים
  // של כל הכיתות בכל יום — רלוונטי בעיקר בטווחים ארוכים (חודש/שנה)
  const slotsByWeekday = useMemo(() => {
    const map = new Map<number, { classData: DashboardClassData; slot: TemplateSlotWithEmployee }[]>()
    if (!data) return map
    for (const classData of data.classes) {
      for (const slot of classData.slots) {
        if (!map.has(slot.weekday)) map.set(slot.weekday, [])
        map.get(slot.weekday)!.push({ classData, slot })
      }
    }
    return map
  }, [data])

  const rows = useMemo(() => {
    if (!data || !ctx || !employeeId || !startDate || !endDate) return []

    // מקובצות לפי תאריך+כיתה+סטטוס — אם אותה כיתה מופיעה גם בבוקר וגם בצהריים באותו
    // סטטוס, מוצגות כשורה אחת עם חלק יום "ארוך" במקום שתי שורות זהות
    const groups = new Map<
      string,
      { date: string; weekday: number; className: string; kind: RowKind; parts: Set<DayPart> }
    >()

    for (const date of dateRange(startDate, endDate)) {
      const wd = systemWeekday(parseISODate(date))
      for (const { classData, slot } of slotsByWeekday.get(wd) ?? []) {
        if (slot.day_part === 'afternoon' && wd === FRIDAY_WD) continue
        const status = resolveSlotStatus(slot, date, ctx)

        let kind: RowKind | null = null
        if (status.kind === 'filled_permanent' && status.employeeId === employeeId) kind = 'permanent'
        else if (status.kind === 'filled_sub' && status.employeeId === employeeId) kind = 'sub'
        else if (status.kind === 'filled_leave_sub' && status.employeeId === employeeId) kind = 'leave_sub'
        else if (status.kind === 'missing' && slot.assigned_employee_id === employeeId) {
          kind = ctx.absenceSet.has(`${employeeId}:${date}`) ? 'absent' : 'leave'
        }
        if (!kind) continue

        const key = `${date}:${classData.classRow.id}:${kind}`
        if (!groups.has(key)) {
          groups.set(key, {
            date,
            weekday: wd,
            className: classData.classRow.name,
            kind,
            parts: new Set(),
          })
        }
        groups.get(key)!.parts.add(slot.day_part)
      }
    }

    const result: ReportRow[] = [...groups.values()].map((g) => ({
      date: g.date,
      weekday: g.weekday,
      className: g.className,
      kind: g.kind,
      dayPart: g.parts.has('morning') && g.parts.has('afternoon') ? 'long' : g.parts.has('morning') ? 'morning' : 'afternoon',
    }))

    result.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.dayPart === b.dayPart ? 0 : a.dayPart === 'morning' ? -1 : 1) ||
        a.className.localeCompare(b.className, 'he'),
    )
    return result
  }, [data, ctx, employeeId, startDate, endDate, slotsByWeekday])

  const sortedEmployees = useMemo(
    () => [...(allEmployees ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name, 'he')),
    [allEmployees],
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">דוח לעובדת</h1>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px]"
            value={employeeId ?? ''}
            onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">בחרי עובדת…</option>
            {sortedEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13px]"
          />
          <span className="text-ink-soft">עד</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13px]"
          />

          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            <input
              type="checkbox"
              checked={showClass}
              onChange={(e) => setShowClass(e.target.checked)}
            />
            הצג כיתה
          </label>
        </div>
      </div>

      {!employeeId ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-center text-ink-soft">
          בחרי עובדת כדי להציג את טבלת השיבוצים שלה
        </div>
      ) : isLoading || !data || !ctx ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-center text-ink-soft">
          אין נתונים בטווח שנבחר
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f6f2] text-right text-[11.5px] text-ink-soft">
                <th className="border-b border-line px-3 py-2 font-medium">תאריך</th>
                {showClass && <th className="border-b border-line px-3 py-2 font-medium">כיתה</th>}
                <th className="border-b border-line px-3 py-2 font-medium">חלק יום</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.date}:${row.className}:${row.kind}`}
                  className={`border-b border-line last:border-0 ${KIND_ROW_CLASS[row.kind]}`}
                >
                  <td className="px-3 py-2">
                    {WEEKDAY_LABELS[row.weekday]} · {toHebrewDateLabel(parseISODate(row.date))}
                  </td>
                  {showClass && <td className="px-3 py-2">כיתה {row.className}</td>}
                  <td className="px-3 py-2">{DAY_PART_REPORT_LABELS[row.dayPart]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
