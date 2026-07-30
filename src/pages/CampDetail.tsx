import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useAuth } from '../lib/AuthContext'
import { useClasses } from '../hooks/useClasses'
import { useEmployees, type EmployeeWithType } from '../hooks/useEmployees'
import { useCamp, useCampDashboardData } from '../hooks/useCamps'
import { useOpeningRoster } from '../hooks/useOpeningRoster'
import { useSchoolSettings } from '../hooks/useSchoolSettings'
import { buildResolveContext, computeOccupancyMap } from '../lib/resolveDashboard'
import {
  addDays,
  datesInRange,
  formatDisplayDate,
  parseISODate,
  systemWeekday,
  toISODate,
  weekStart,
} from '../lib/dateUtils'
import { WEEKDAY_LABELS, type DayPart } from '../types/schedule'
import type { CampPeriodRow } from '../types/camps'
import type { SlotOccupancy } from '../types/dashboard'
import { ClassGrid } from '../components/dashboard/ClassGrid'
import { OpeningCell } from '../components/opening/OpeningCell'

const WEEKDAYS = [1, 2, 3, 4, 5, 6]
const SATURDAY_WEEKDAY = 7

// כל התאריכים בטווח, בלי שבתות (בית הספר לא פעיל בשבת — ראו גם FRIDAY_WD ב-ClassGrid)
function workingDatesInRange(startDate: string, endDate: string): string[] {
  return datesInRange(startDate, endDate).filter((d) => systemWeekday(parseISODate(d)) !== SATURDAY_WEEKDAY)
}

interface CampWeek {
  weekNumber: number
  start: string
  end: string
}

function computeCampWeeks(startDate: string, endDate: string): CampWeek[] {
  const weeks: CampWeek[] = []
  let cursor = weekStart(parseISODate(startDate))
  const endD = parseISODate(endDate)
  let n = 1
  while (cursor <= endD) {
    weeks.push({ weekNumber: n, start: toISODate(cursor), end: toISODate(addDays(cursor, 6)) })
    cursor = addDays(cursor, 7)
    n++
  }
  return weeks
}

// מסך קייטנה בודדת (3.10/5.3): מסך אחד, בדיוק כמו הדאשבורד הרגיל — טווח תאריכים + היקף
// (כל הכיתות/כיתה ספציפית), ובכל תא מוצגים גם השיבוץ הקבוע וגם החורים לשיבוץ מ"מ יחד.
// עריכת השיבוץ הקבוע (מי העובדת הקבועה לכל תפקיד) נעשית מאותו תא בדיוק כמו שיבוץ מ"מ יומי
// (ראו canEditPermanent ב-DashboardSlotCell) — אין כאן מסך "שיבוץ בסיסי" נפרד כמו בשנה הרגילה.
// השנה הרגילה אינה רלוונטית בזמן קייטנה, ולכן useCampDashboardData שולף רק תבניות camp.
// מערכת הפתיחות השבועית-לקייטנה מוצגת כסעיף מתקפל בתחתית, כדי לא להפריע לזרימה העיקרית.
export default function CampDetail() {
  const { campId: campIdParam } = useParams()
  const campId = campIdParam ? Number(campIdParam) : undefined
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()

  const { data: camp, isLoading: campLoading } = useCamp(campId)
  const { data: classes } = useClasses(schoolId)
  const { data: allEmployees } = useEmployees(schoolId)
  const { data: schoolSettings } = useSchoolSettings(schoolId)
  const dateDisplayMode = schoolSettings?.date_display ?? 'hebrew'

  const [scopeClassId, setScopeClassId] = useState<number | 'all'>('all')

  // כל השבועות (ראשון-שישי) שחופפים את טווח הקייטנה הכולל — משותף לתצוגת השיבוץ הראשית
  // ולמערכת הפתיחות (5.4/3.10), כך שיום מוצג באותה "חלוקה לשבועות" בשני המקומות. שבוע תמיד
  // מוצג במלואו, גם אם חלק מהימים בו לא נכללים באף camp_period — אותם ימים מוצגים כ-disabled
  // (ראו isCellDisabled) במקום להיעלם/לגרום לקפיצה לתאריכים לא-רציפים.
  const campWeeks = useMemo(
    () => (camp ? computeCampWeeks(camp.start_date, camp.end_date) : []),
    [camp],
  )

  const periodByDate = useMemo(() => {
    const map = new Map<string, CampPeriodRow>()
    for (const p of camp?.camp_periods ?? []) {
      for (const d of workingDatesInRange(p.start_date, p.end_date)) map.set(d, p)
    }
    return map
  }, [camp])

  const [weekNumber, setWeekNumber] = useState(1)
  const currentWeek = campWeeks.find((w) => w.weekNumber === weekNumber)
  const visibleDates = useMemo(
    () => (currentWeek ? [0, 1, 2, 3, 4, 5].map((i) => toISODate(addDays(parseISODate(currentWeek.start), i))) : []),
    [currentWeek],
  )
  const rangeStart = visibleDates[0]
  const rangeEnd = visibleDates[visibleDates.length - 1]

  const { data: dashboardData, isLoading: dashboardLoading } = useCampDashboardData(
    schoolId,
    campId,
    rangeStart,
    rangeEnd,
  )

  function isCellDisabled(date: string, dayPart: DayPart): boolean {
    const period = periodByDate.get(date)
    if (!period) return true
    return dayPart === 'morning' ? !period.includes_morning : !period.includes_afternoon
  }

  const employeesById = useMemo(() => new Map((allEmployees ?? []).map((e) => [e.id, e])), [allEmployees])

  // עובדות המשובצות לחור בוקר כלשהו (בכיתה כלשהי), לפי יום בשבוע — מתוך שיבוץ הקייטנה הפעיל
  // (לא השנה הרגילה). זו רשימת הבחירה המוגבלת לתפקידי פתיחה בקייטנה, מקביל ל-
  // useMorningStaffByWeekday של מסך "מערכת פתיחות" הרגיל.
  const campMorningStaffByWeekday = useMemo(() => {
    const byWeekday = new Map<number, Map<number, EmployeeWithType>>()
    for (const classData of dashboardData?.classes ?? []) {
      for (const slot of classData.slots) {
        if (slot.day_part !== 'morning' || !slot.assigned_employee_id) continue
        const emp = employeesById.get(slot.assigned_employee_id)
        if (!emp) continue
        if (!byWeekday.has(slot.weekday)) byWeekday.set(slot.weekday, new Map())
        byWeekday.get(slot.weekday)!.set(emp.id, emp)
      }
    }
    const result: Record<number, EmployeeWithType[]> = {}
    for (const [wd, empMap] of byWeekday.entries()) {
      result[wd] = [...empMap.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'))
    }
    return result
  }, [dashboardData, employeesById])

  const ctx = useMemo(
    () =>
      dashboardData
        ? buildResolveContext(dashboardData.absences, dashboardData.leaves, dashboardData.dailyAssignments)
        : null,
    [dashboardData],
  )
  const occupancyMap = useMemo(
    () =>
      dashboardData && ctx
        ? computeOccupancyMap(dashboardData.classes, visibleDates, ctx)
        : new Map<string, SlotOccupancy>(),
    [dashboardData, ctx, visibleDates],
  )

  const visibleClasses = useMemo(
    () =>
      !dashboardData
        ? []
        : scopeClassId === 'all'
          ? dashboardData.classes
          : dashboardData.classes.filter((c) => c.classRow.id === scopeClassId),
    [dashboardData, scopeClassId],
  )

  // ---- מערכת פתיחות (מתקפלת) ----
  const [openingExpanded, setOpeningExpanded] = useState(false)
  const { data: openingRoster } = useOpeningRoster(
    schoolId,
    campId && openingExpanded ? { campId, weekNumber } : undefined,
  )

  if (campLoading) {
    return <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
  }
  if (!camp) {
    return (
      <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">
        קייטנה לא נמצאה. <Link to="/camps" className="text-accent underline">חזרה לרשימת הקייטנות</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/camps" className="text-[12.5px] text-ink-soft hover:underline print:hidden">
            ← ניהול קייטנות
          </Link>
          <h1 className="mt-1 text-xl font-bold">{camp.name}</h1>
          <div className="mt-0.5 text-[13px] text-ink-soft">
            {formatDisplayDate(parseISODate(camp.start_date), dateDisplayMode)} – {formatDisplayDate(parseISODate(camp.end_date), dateDisplayMode)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={weekNumber <= 1}
              onClick={() => setWeekNumber((w) => Math.max(1, w - 1))}
              className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] hover:bg-[#f2f0ea] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>

            <div className="min-w-[210px] text-center text-[12.5px] text-ink-soft">
              {visibleDates.length > 0
                ? `שבוע ${weekNumber} (${formatDisplayDate(parseISODate(visibleDates[0]), dateDisplayMode)} – ${formatDisplayDate(parseISODate(visibleDates[visibleDates.length - 1]), dateDisplayMode)})`
                : 'אין תאריכים מוגדרים לקייטנה זו'}
            </div>

            <button
              type="button"
              disabled={weekNumber >= campWeeks.length}
              onClick={() => setWeekNumber((w) => Math.min(campWeeks.length, w + 1))}
              className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] hover:bg-[#f2f0ea] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>

          <select
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px]"
            value={scopeClassId}
            onChange={(e) => setScopeClassId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">כל הכיתות</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                כיתה {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* table+thead: הדפדפן חוזר אוטומטית על thead בראש כל עמוד מודפס שאליו נשברת tbody —
          כך הקשר "שבוע X" (שמוסתר בהדפסה בתוך הכותרת העליונה) לא הולך לאיבוד ברשת רב-עמודית */}
      <table className="w-full border-collapse">
        <thead className="hidden print:table-header-group">
          <tr>
            <th className="pb-3 text-center text-[13px] font-medium">
              {visibleDates.length > 0
                ? `שבוע ${weekNumber} (${formatDisplayDate(parseISODate(visibleDates[0]), dateDisplayMode)} – ${formatDisplayDate(parseISODate(visibleDates[visibleDates.length - 1]), dateDisplayMode)})`
                : ''}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-0">
              {dashboardLoading || !dashboardData || !ctx ? (
                <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
              ) : (
                <div className="print-grid-shrink grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
                  {visibleClasses.map((classData) => (
                    <div key={classData.classRow.id} className="break-inside-avoid">
                      <ClassGrid
                        classData={classData}
                        dates={visibleDates}
                        ctx={ctx}
                        employeesById={employeesById}
                        allEmployees={allEmployees ?? []}
                        occupancyMap={occupancyMap}
                        schoolId={schoolId!}
                        createdBy={profile?.id ?? null}
                        dateDisplayMode={dateDisplayMode}
                        isCellDisabled={isCellDisabled}
                      />
                    </div>
                  ))}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <details
        className="mt-6 rounded-xl border border-line bg-panel px-3 py-2.5 print:hidden"
        onToggle={(e) => setOpeningExpanded(e.currentTarget.open)}
      >
        <summary className="cursor-pointer select-none text-[12.5px] font-medium text-ink-soft">
          מערכת פתיחות לקייטנה
        </summary>

        {openingExpanded && (
          <div className="mt-3">
            <div className="mb-3 text-[12.5px] text-ink-soft">
              שבוע {weekNumber} — לפי הניווט למעלה
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <colgroup>
                  <col className="w-[110px]" />
                  {WEEKDAYS.map((wd) => (
                    <col key={wd} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="border-b border-line px-2 py-2 text-right text-[12px] text-ink-soft">תפקיד</th>
                    {WEEKDAYS.map((wd) => (
                      <th key={wd} className="border-b border-line px-1.5 py-2 text-right text-[12px] text-ink-soft">
                        {WEEKDAY_LABELS[wd]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openingRoster && openingRoster.length > 0 ? (
                    openingRoster.map((role) => (
                      <tr key={role.id}>
                        <td className="border-t border-line px-2 py-2 text-[12.5px] font-medium">{role.name}</td>
                        {WEEKDAYS.map((wd) =>
                          schoolId && campId ? (
                            <OpeningCell
                              key={wd}
                              schoolId={schoolId}
                              roleId={role.id}
                              weekday={wd}
                              assignment={role.assignments[wd]}
                              availableEmployees={campMorningStaffByWeekday[wd] ?? []}
                              roster={openingRoster ?? []}
                              campContext={{ campId, weekNumber }}
                            />
                          ) : (
                            <td key={wd} />
                          ),
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={WEEKDAYS.length + 1} className="px-3 py-3 text-center text-[12px] text-ink-soft">
                        אין תפקידי פתיחה מוגדרים.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </details>
    </div>
  )
}
