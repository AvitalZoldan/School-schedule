import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useClasses } from '../hooks/useClasses'
import { useEmployees } from '../hooks/useEmployees'
import { useDashboardData } from '../hooks/useDashboard'
import { useDailyOpeningAssignments, useOpeningRoster } from '../hooks/useOpeningRoster'
import { useSchoolSettings } from '../hooks/useSchoolSettings'
import { useHolidays } from '../hooks/useHolidays'
import { addDays, formatDisplayDate, parseISODate, systemWeekday, toISODate, weekDates } from '../lib/dateUtils'
import {
  buildResolveContext,
  computeMorningPresenceByDate,
  computeOccupancyMap,
  computeOpeningGaps,
  occupancyKey,
} from '../lib/resolveDashboard'
import { WEEKDAY_LABELS } from '../types/schedule'
import { ClassGrid } from '../components/dashboard/ClassGrid'
import { LeaveReminderBanner } from '../components/dashboard/LeaveReminderBanner'
import { OpeningGapRow } from '../components/opening/OpeningGapRow'
import { SegmentedToggle } from '../components/common/SegmentedToggle'

type RangeMode = 'day' | 'week'

// שבת (weekday=7) היא תמיד יום סגור — אין שיבוץ בסיסי, אין תפקידי פתיחה, שום כיתה לא עובדת בו.
// בתצוגת "יום" (בניגוד לתצוגת "שבוע", ש-weekDates תמיד מחזירה לה ראשון-שישי בלי תלות בעוגן)
// אפשר לנחות על שבת ע"י ניווט חופשי, ואז הלוח מציג רשת ריקה לגמרי — לכן מדלגים עליה.
function skipSaturday(date: Date, direction: 1 | -1): Date {
  let d = date
  while (systemWeekday(d) === 7) {
    d = addDays(d, direction)
  }
  return d
}

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

  // מכסה גם מעבר יזום מ"שבוע" ל"יום" וגם את ברירת המחדל מ"ניהול" (למעלה) — בכל מקרה שבו
  // אנחור נתקע על שבת בתצוגת יום, מדלגים קדימה ליום הראשון הבא שכן פעיל
  useEffect(() => {
    if (rangeMode === 'day' && systemWeekday(anchorDate) === 7) {
      setAnchorDate((d) => skipSaturday(d, 1))
    }
  }, [rangeMode, anchorDate])

  const dates = useMemo(
    () => (rangeMode === 'day' ? [toISODate(anchorDate)] : weekDates(anchorDate)),
    [rangeMode, anchorDate],
  )
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]

  const dateDisplayMode = schoolSettings?.date_display ?? 'hebrew'

  const dateRangeLabel =
    rangeMode === 'day'
      ? formatDisplayDate(parseISODate(startDate), dateDisplayMode)
      : `${formatDisplayDate(parseISODate(startDate), dateDisplayMode)} – ${formatDisplayDate(parseISODate(endDate), dateDisplayMode)}`

  // הנתונים נשלפים תמיד עבור כל הכיתות (ראו useDashboardData) — סינון ה"היקף" הנבחר
  // (כל הכיתות/כיתה ספציפית) מוחל רק על מה שמוצג, כדי שבדיקת התפוסה/כפילות תישאר נכונה
  // גם כשבוחרים כיתה בודדת (עובדת שמשובצת בכיתה אחרת עדיין תזוהה כתפוסה).
  const { data, isLoading } = useDashboardData(schoolId, startDate, endDate)
  const { data: dailyOpeningAssignments } = useDailyOpeningAssignments(schoolId, startDate, endDate)

  // ימי חופש נקבעים במסך "ניהול" (Management.tsx) — כאן רק קוראים אותם כדי לנטרל תאים בתאריך כזה
  const { data: holidays } = useHolidays(schoolId, startDate, endDate)
  const holidaySet = useMemo(() => new Set((holidays ?? []).map((h) => h.holiday_date)), [holidays])

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
    setAnchorDate((d) => {
      const next = addDays(d, deltaDays)
      return rangeMode === 'day' ? skipSaturday(next, deltaDays > 0 ? 1 : -1) : next
    })
  }

  // "חורי פתיחה" (5.7-ג המורחב): לכל תאריך בטווח, תפקיד פתיחה שאין לו כיסוי בפועל — או כי הוא
  // לא מאויש בכלל בשיבוץ השבועי, או כי העובדת המשובצת נעדרת/בחופשה אותו יום ספציפי. בשני
  // המקרים ניתן לשבץ מ"מ ישירות מכאן (daily_opening_assignments), בלי לגעת בשיבוץ השבועי הקבוע.
  const openingGaps = useMemo(
    () => (openingRoles && ctx ? computeOpeningGaps(openingRoles, dates, ctx, dailyOpeningAssignments ?? []) : []),
    [openingRoles, ctx, dates, dailyOpeningAssignments],
  )

  // מי בפועל בבניין בבוקר כל תאריך (לא השיבוץ השבועי הסטטי) — לרשימת המועמדות למ"מ פתיחה
  const morningPresenceByDate = useMemo(
    () => (data && ctx ? computeMorningPresenceByDate(data.classes, dates, ctx) : new Map<string, Set<number>>()),
    [data, ctx, dates],
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
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

          <div className="text-[12.5px] text-ink-soft">{dateRangeLabel}</div>

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

      {schoolId && (
        <div className="mb-4 print:hidden">
          <LeaveReminderBanner schoolId={schoolId} />
        </div>
      )}

      {/* table+thead: הדפדפן חוזר אוטומטית על thead בראש כל עמוד מודפס שאליו נשברת tbody —
          זו הדרך היחידה שעובדת בכל דפדפן בלי תלות בהגדרת "כותרות ותחתיות" בחלון ההדפסה */}
      <table className="w-full border-collapse">
        <thead className="hidden print:table-header-group">
          <tr>
            <th className="pb-3 text-center text-[13px] font-medium">{dateRangeLabel}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-0">
              {isLoading || !data || !ctx ? (
                <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
              ) : (
                <div className="flex flex-col gap-5">
                  {openingGaps.length > 0 && (
                    <div className="rounded-xl border border-line bg-panel p-3 print:hidden">
                      <div className="mb-2 text-[13px] font-bold">חורי פתיחה</div>
                      <div className="flex flex-col gap-1.5">
                        {openingGaps.map((gap) => (
                          <div key={`${gap.roleId}:${gap.date}`} className="flex items-center gap-2">
                            <div className="w-32 shrink-0 text-[12px] text-ink-soft">
                              {WEEKDAY_LABELS[gap.weekday]} · {formatDisplayDate(parseISODate(gap.date), dateDisplayMode)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <OpeningGapRow
                                gap={gap}
                                morningStaff={(allEmployees ?? []).filter((e) =>
                                  morningPresenceByDate.get(gap.date)?.has(e.id),
                                )}
                                employeesById={employeesById}
                                getOccupancy={(employeeId) =>
                                  occupancyMap.get(occupancyKey(gap.date, 'morning', employeeId)) ?? null
                                }
                                schoolId={schoolId!}
                                createdBy={profile?.id ?? null}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className="print-grid-shrink grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(auto-fit, minmax(${rangeMode === 'week' ? 420 : 230}px, 1fr))`,
                    }}
                  >
                    {visibleClasses.map((classData) => (
                      <div key={classData.classRow.id} className="break-inside-avoid">
                        <ClassGrid
                          classData={classData}
                          dates={dates}
                          ctx={ctx}
                          employeesById={employeesById}
                          allEmployees={allEmployees ?? []}
                          occupancyMap={occupancyMap}
                          schoolId={schoolId!}
                          createdBy={profile?.id ?? null}
                          dateDisplayMode={dateDisplayMode}
                          isCellDisabled={(date) => holidaySet.has(date)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
