import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useClasses } from '../hooks/useClasses'
import { useEmployees } from '../hooks/useEmployees'
import { useDashboardData } from '../hooks/useDashboard'
import { useOpeningRoster } from '../hooks/useOpeningRoster'
import { useSchoolSettings } from '../hooks/useSchoolSettings'
import { addDays, parseISODate, toHebrewDateLabel, toISODate, weekDates } from '../lib/dateUtils'
import { buildResolveContext, computeOccupancyMap } from '../lib/resolveDashboard'
import { WEEKDAY_LABELS } from '../types/schedule'
import { ClassGrid } from '../components/dashboard/ClassGrid'
import { LeaveReminderBanner } from '../components/dashboard/LeaveReminderBanner'
import { SegmentedToggle } from '../components/common/SegmentedToggle'

type RangeMode = 'day' | 'week'

export default function Dashboard() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const { data: classes } = useClasses(schoolId)
  const { data: allEmployees } = useEmployees(schoolId)
  const { data: openingRoles } = useOpeningRoster(schoolId)
  const { data: schoolSettings } = useSchoolSettings(schoolId)

  const [rangeMode, setRangeMode] = useState<RangeMode>('week')
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date())
  const [scopeClassId, setScopeClassId] = useState<number | 'all'>('all')

  // מיישם את ברירת המחדל (יום/שבוע) ממסך "ניהול" פעם אחת עם טעינת ההגדרות, כדי לא לדרוס
  // בחירה ידנית של המשתמשת בהמשך אם ה-query מתעדכן ברקע.
  const appliedDefaultRange = useRef(false)
  useEffect(() => {
    if (!appliedDefaultRange.current && schoolSettings) {
      setRangeMode(schoolSettings.dashboard_default_range)
      appliedDefaultRange.current = true
    }
  }, [schoolSettings])

  const dates = useMemo(
    () => (rangeMode === 'day' ? [toISODate(anchorDate)] : weekDates(anchorDate)),
    [rangeMode, anchorDate],
  )
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]

  // הנתונים נשלפים תמיד עבור כל הכיתות (ראו useDashboardData) — סינון ה"היקף" הנבחר
  // (כל הכיתות/כיתה ספציפית) מוחל רק על מה שמוצג, כדי שבדיקת התפוסה/כפילות תישאר נכונה
  // גם כשבוחרים כיתה בודדת (עובדת שמשובצת בכיתה אחרת עדיין תזוהה כתפוסה).
  const { data, isLoading } = useDashboardData(schoolId, startDate, endDate)
  const visibleClasses = useMemo(
    () =>
      !data
        ? []
        : scopeClassId === 'all'
          ? data.classes
          : data.classes.filter((c) => c.classRow.id === scopeClassId),
    [data, scopeClassId],
  )

  const employeesById = useMemo(
    () => new Map((allEmployees ?? []).map((e) => [e.id, e])),
    [allEmployees],
  )

  const ctx = useMemo(
    () => (data ? buildResolveContext(data.absences, data.leaves, data.dailyAssignments) : null),
    [data],
  )

  const occupancyMap = useMemo(
    () => (data && ctx ? computeOccupancyMap(data.classes, dates, ctx) : new Map()),
    [data, ctx, dates],
  )

  function shift(deltaDays: number) {
    setAnchorDate((d) => addDays(d, deltaDays))
  }

  // תפקידי פתיחה לא-מאוישים לימי השבוע שבטווח הנבחר (5.7-ג: "כולל תפקידי פתיחה לא-מאוישים
  // כקטגוריה נפרדת"). מערכת הפתיחה שבועית-קבועה וללא היעדרות חד-פעמית במודל הנתונים,
  // לכן זו תצוגת מידע (לעריכה יש לפתוח את מסך "מערכת פתיחות").
  const weekdaysInRange = useMemo(
    () => [...new Set(dates.map((d) => new Date(d).getDay() + 1))],
    [dates],
  )
  const missingOpening = useMemo(() => {
    if (!openingRoles) return []
    const result: { weekday: number; roleName: string }[] = []
    for (const role of openingRoles) {
      for (const wd of weekdaysInRange) {
        if (!role.assignments[wd]?.employee_id) {
          result.push({ weekday: wd, roleName: role.name })
        }
      }
    }
    return result
  }, [openingRoles, weekdaysInRange])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">לוח בקרה</h1>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedToggle
            value={rangeMode}
            onChange={setRangeMode}
            options={[
              { value: 'day', label: 'יום' },
              { value: 'week', label: 'שבוע' },
            ]}
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(rangeMode === 'day' ? -1 : -7)}
              className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] hover:bg-[#f2f0ea]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setAnchorDate(new Date())}
              className="rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] hover:bg-[#f2f0ea]"
            >
              היום
            </button>
            <button
              type="button"
              onClick={() => shift(rangeMode === 'day' ? 1 : 7)}
              className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] hover:bg-[#f2f0ea]"
            >
              ›
            </button>
          </div>

          <div className="text-[12.5px] text-ink-soft">
            {rangeMode === 'day'
              ? toHebrewDateLabel(parseISODate(startDate))
              : `${toHebrewDateLabel(parseISODate(startDate))} – ${toHebrewDateLabel(parseISODate(endDate))}`}
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

      {schoolId && <div className="mb-4"><LeaveReminderBanner schoolId={schoolId} /></div>}

      {isLoading || !data || !ctx ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
      ) : (
        <div className="flex flex-col gap-5">
          {missingOpening.length > 0 && (
            <div className="rounded-xl border border-line bg-panel p-3">
              <div className="mb-2 text-[13px] font-bold">תפקידי פתיחה לא-מאוישים</div>
              <ul className="flex flex-col gap-1 text-[12.5px]">
                {missingOpening.map((m, i) => (
                  <li key={i} className="text-warn">
                    {WEEKDAY_LABELS[m.weekday]} — {m.roleName}
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-[11.5px] text-ink-soft">
                לעריכה יש לפתוח את מסך "מערכת פתיחות".
              </div>
            </div>
          )}

          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(${rangeMode === 'week' ? 420 : 230}px, 1fr))`,
            }}
          >
            {visibleClasses.map((classData) => (
              <ClassGrid
                key={classData.classRow.id}
                classData={classData}
                dates={dates}
                ctx={ctx}
                employeesById={employeesById}
                allEmployees={allEmployees ?? []}
                occupancyMap={occupancyMap}
                schoolId={schoolId!}
                createdBy={profile?.id ?? null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
