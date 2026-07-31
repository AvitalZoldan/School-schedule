import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useCurrentSchoolId } from '../hooks/useSchool'
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
  resolveSlotStatus,
} from '../lib/resolveDashboard'
import { DAY_PART_LABELS, WEEKDAY_LABELS } from '../types/schedule'
import type { DayPart, TemplateSlotWithEmployee } from '../types/schedule'
import type { SlotDayStatus } from '../types/dashboard'
import { SegmentedToggle } from '../components/common/SegmentedToggle'
import { MissingSlotRow } from '../components/missing/MissingSlotRow'
import { OpeningGapRow } from '../components/opening/OpeningGapRow'

type RangeMode = 'day' | 'week'
type ViewMode = 'byClass' | 'byDayPart'

const FRIDAY_WEEKDAY = Object.entries(WEEKDAY_LABELS).find(([, label]) => label === 'שישי')?.[0]
const FRIDAY_WD = FRIDAY_WEEKDAY !== undefined ? Number(FRIDAY_WEEKDAY) : undefined

// שבת (weekday=7) תמיד סגורה — בתצוגת "יום" (בניגוד ל"שבוע", ש-weekDates תמיד מחזירה ראשון-שישי)
// ניווט חופשי יכול לנחות עליה ולהציג עמוד ריק לגמרי, לכן מדלגים
function skipSaturday(date: Date, direction: 1 | -1): Date {
  let d = date
  while (systemWeekday(d) === 7) {
    d = addDays(d, direction)
  }
  return d
}

interface MissingItem {
  slot: TemplateSlotWithEmployee
  classId: number
  className: string
  date: string
  status: Extract<SlotDayStatus, { kind: 'missing' | 'filled_sub' }>
}

export default function SubstituteAssignment() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const { data: allEmployees } = useEmployees(schoolId)
  const { data: openingRoles } = useOpeningRoster(schoolId)
  const { data: schoolSettings } = useSchoolSettings(schoolId)
  const dateDisplayMode = schoolSettings?.date_display ?? 'hebrew'

  const [rangeMode, setRangeMode] = useState<RangeMode>('week')
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('byClass')

  // אותה ברירת מחדל (יום/שבוע) כמו בלוח הבקרה — נטענת פעם אחת ולא דורסת בחירה ידנית בהמשך
  const appliedDefaultRange = useRef(false)
  useEffect(() => {
    if (!appliedDefaultRange.current && schoolSettings) {
      setRangeMode(schoolSettings.dashboard_default_range)
      appliedDefaultRange.current = true
    }
  }, [schoolSettings])

  // מכסה גם מעבר יזום מ"שבוע" ל"יום" וגם את ברירת המחדל מ"ניהול" (למעלה) — בכל מקרה שבו
  // העוגן נתקע על שבת בתצוגת יום, מדלגים קדימה ליום הראשון הבא שכן פעיל
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

  const { data, isLoading } = useDashboardData(schoolId, startDate, endDate)
  const { data: dailyOpeningAssignments } = useDailyOpeningAssignments(schoolId, startDate, endDate)
  const { data: holidays } = useHolidays(schoolId, startDate, endDate)
  const holidaySet = useMemo(() => new Set((holidays ?? []).map((h) => h.holiday_date)), [holidays])

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

  const itemsByDate = useMemo(() => {
    if (!data || !ctx) return new Map<string, MissingItem[]>()
    const result = new Map<string, MissingItem[]>()
    for (const date of dates) {
      if (holidaySet.has(date)) continue
      const wd = systemWeekday(parseISODate(date))
      const items: MissingItem[] = []
      for (const classData of data.classes) {
        for (const slot of classData.slots) {
          if (slot.weekday !== wd) continue
          if (slot.day_part === 'afternoon' && wd === FRIDAY_WD) continue
          const status = resolveSlotStatus(slot, date, ctx)
          if (status.kind !== 'missing' && status.kind !== 'filled_sub') continue
          items.push({ slot, classId: classData.classRow.id, className: classData.classRow.name, date, status })
        }
      }
      items.sort((a, b) => {
        const aOpen = a.status.kind === 'missing'
        const bOpen = b.status.kind === 'missing'
        if (aOpen !== bOpen) return aOpen ? -1 : 1
        const aCritical = a.status.kind === 'missing' && a.status.criticality === 'critical'
        const bCritical = b.status.kind === 'missing' && b.status.criticality === 'critical'
        if (aCritical !== bCritical) return aCritical ? -1 : 1
        return a.className.localeCompare(b.className, 'he') || a.slot.role.localeCompare(b.slot.role, 'he')
      })
      if (items.length > 0) result.set(date, items)
    }
    return result
  }, [data, ctx, dates, holidaySet])

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

  const totalOpen = useMemo(
    () => [...itemsByDate.values()].flat().filter((i) => i.status.kind === 'missing').length,
    [itemsByDate],
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">שיבוץ מ"מ</h1>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <SegmentedToggle
            value={rangeMode}
            onChange={setRangeMode}
            options={[
              { value: 'day', label: 'יום' },
              { value: 'week', label: 'שבוע' },
            ]}
          />

          <SegmentedToggle
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'byClass', label: 'תצוגת כיתות' },
              { value: 'byDayPart', label: 'תצוגת בוקר/צהריים' },
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
              ? formatDisplayDate(parseISODate(startDate), dateDisplayMode)
              : `${formatDisplayDate(parseISODate(startDate), dateDisplayMode)} – ${formatDisplayDate(parseISODate(endDate), dateDisplayMode)}`}
          </div>
        </div>
      </div>

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

          {itemsByDate.size === 0 ? (
            <div className="rounded-xl border border-line bg-panel p-[18px] text-center text-ink-soft">
              אין חורים בטווח שנבחר 🎉
            </div>
          ) : (
            <>
              <div
                className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-[12.5px] font-medium ${
                  totalOpen > 0 ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'
                }`}
              >
                {totalOpen > 0 ? `${totalOpen} חורים פתוחים לשיבוץ` : 'כל החורים בטווח שובצו 🎉'}
              </div>
              {dates
                .filter((date) => itemsByDate.has(date))
                .map((date) => {
                  const wd = systemWeekday(parseISODate(date))
                  const dayItems = itemsByDate.get(date)!
                  const dateHeader = (
                    <div className="text-[13px] font-bold">
                      {WEEKDAY_LABELS[wd]} · {formatDisplayDate(parseISODate(date), dateDisplayMode)}
                    </div>
                  )

                  const rowProps = (item: MissingItem, opts: { showClassName: boolean }) => ({
                    key: `${item.slot.id}:${item.date}`,
                    slot: item.slot,
                    classId: item.classId,
                    className: item.className,
                    showClassName: opts.showClassName,
                    date: item.date,
                    status: item.status,
                    employeesById,
                    allEmployees: allEmployees ?? [],
                    getOccupancy: (employeeId: number) =>
                      occupancyMap.get(occupancyKey(date, item.slot.day_part, employeeId)) ?? null,
                    schoolId: schoolId!,
                    createdBy: profile?.id ?? null,
                  })

                  if (viewMode === 'byDayPart') {
                    const byPart: Record<DayPart, MissingItem[]> = {
                      morning: dayItems.filter((i) => i.slot.day_part === 'morning'),
                      afternoon: dayItems.filter((i) => i.slot.day_part === 'afternoon'),
                    }
                    return (
                      <div key={date} className="flex flex-col gap-1.5">
                        {dateHeader}
                        <div className="grid gap-3 md:grid-cols-2">
                          {(['morning', 'afternoon'] as const).map((part) => (
                            <div key={part} className="break-inside-avoid rounded-lg border border-line bg-[#f7f6f2] p-2">
                              <div
                                className={`mb-2 w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                  part === 'morning' ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent'
                                }`}
                              >
                                {DAY_PART_LABELS[part]} ({byPart[part].length})
                              </div>
                              {byPart[part].length === 0 ? (
                                <div className="px-1 py-1 text-[11.5px] text-ink-soft">אין חורים</div>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {byPart[part].map((item) => (
                                    <MissingSlotRow {...rowProps(item, { showClassName: true })} />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  // מקובצים לפי כיתה כדי שבוקר וצהריים של אותה כיתה יופיעו צמודים זה לזה
                  const classGroups = new Map<
                    number,
                    { className: string; byPart: Record<DayPart, MissingItem[]> }
                  >()
                  for (const item of dayItems) {
                    if (!classGroups.has(item.classId)) {
                      classGroups.set(item.classId, {
                        className: item.className,
                        byPart: { morning: [], afternoon: [] },
                      })
                    }
                    classGroups.get(item.classId)!.byPart[item.slot.day_part].push(item)
                  }
                  const sortedGroups = [...classGroups.values()].sort((a, b) =>
                    a.className.localeCompare(b.className, 'he'),
                  )

                  return (
                    <div key={date} className="flex flex-col gap-1.5">
                      {dateHeader}
                      <div
                        className="print-grid-shrink grid gap-2"
                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}
                      >
                        {sortedGroups.map((group) => {
                          const hasBoth = group.byPart.morning.length > 0 && group.byPart.afternoon.length > 0
                          return (
                            <div
                              key={group.className}
                              className="break-inside-avoid rounded-lg border border-line border-t-[3px] border-t-accent bg-[#f7f6f2] p-2"
                            >
                              <div className="mb-1.5 border-b border-line pb-1 text-[12.5px] font-semibold">
                                כיתה {group.className}
                              </div>
                              <div className={hasBoth ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1.5'}>
                                {(['morning', 'afternoon'] as const).map((part) => {
                                  const items = group.byPart[part]
                                  if (items.length === 0) return null
                                  return (
                                    <div key={part} className="flex flex-col gap-1.5">
                                      <div
                                        className={`w-fit rounded px-1.5 py-0.5 text-[10.5px] font-medium ${
                                          part === 'morning' ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent'
                                        }`}
                                      >
                                        {DAY_PART_LABELS[part]}
                                      </div>
                                      {items.map((item) => (
                                        <MissingSlotRow {...rowProps(item, { showClassName: false })} />
                                      ))}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
