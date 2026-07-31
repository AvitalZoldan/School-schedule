import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useEmployees, type EmployeeWithType } from '../../hooks/useEmployees'
import { useDashboardData } from '../../hooks/useDashboard'
import { useClearDailyAssignment, useMarkAbsence } from '../../hooks/useDashboard'
import {
  useCreateLeave,
  useUpdateLeave,
  useLeaves,
  type LeaveWithEmployee,
  type LeaveFormInput,
  type LeaveDayAssignmentInput,
} from '../../hooks/useLeaves'
import { buildResolveContext, computeOccupancyMap, occupancyKey } from '../../lib/resolveDashboard'
import type { SlotOccupancy } from '../../types/dashboard'
import { datesInRange, parseISODate, systemWeekday, toGregorianDateLabel, toISODate } from '../../lib/dateUtils'
import { DAY_PART_LABELS, WEEKDAY_LABELS, type DayPart } from '../../types/schedule'
import { SubstituteCombobox } from '../dashboard/SubstituteCombobox'
import { useConfirm } from '../common/ConfirmProvider'
import { EmployeeHoverCard } from '../common/EmployeeHoverCard'
import { buildTransferConfirmMessage } from '../../lib/conflictMessages'

const REMINDER_PRESETS = [3, 7, 14]

interface Props {
  schoolId: number
  employee: EmployeeWithType
  existingLeave?: LeaveWithEmployee
  createdBy: string | null
  onClose: () => void
}

interface SlotRow {
  slotId: number
  className: string
  dayPart: DayPart
}

interface DateGroup {
  date: string
  weekday: number
  rows: SlotRow[]
}

function dayAssignmentKey(date: string, slotId: number): string {
  return `${date}:${slotId}`
}

// טופס יצירה/עריכה של חופשה לעובדת קבועה (3.7 באפיון): נפתח מכפתור "הוספת/ניהול חופשה" במסך
// עובדות, ומשמש גם לעריכה מתוך לשונית "חופשות" (היסטוריה). משתמש חוזר בתשתית הדשבורד הקיימת
// (useDashboardData/buildResolveContext/computeOccupancyMap) כדי לחשב אילו משבצות בטווח באמת
// רלוונטיות (יש לעובדת בהן משבצת קבועה), ולזהות כפילות שיבוץ בבחירת מ"מ מראש. השיוך הוא לפי
// משבצת ספציפית (כיתה+חלק יום) ולא לפי יום שלם — כך אפשר מ"מ שונה לבוקר ולצהריים באותו יום.
export function LeaveFormModal({ schoolId, employee, existingLeave, createdBy, onClose }: Props) {
  const today = toISODate(new Date())

  const [startDate, setStartDate] = useState(existingLeave?.start_date ?? today)
  const [endDate, setEndDate] = useState(existingLeave?.end_date ?? today)
  const [reminderDaysBefore, setReminderDaysBefore] = useState(existingLeave?.reminder_days_before ?? 7)
  const [notes, setNotes] = useState(existingLeave?.notes ?? '')
  const [slotAssignments, setSlotAssignments] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const da of existingLeave?.leave_day_assignments ?? []) {
      map[dayAssignmentKey(da.assignment_date, da.slot_id)] = da.employee_id
    }
    return map
  })
  // ברירת מחדל: לא לשייך מ"מ מראש (3.7 — אופציונלי). נפתח אוטומטית בעריכה אם כבר יש שיוכים קיימים.
  const [assignSubsInAdvance, setAssignSubsInAdvance] = useState(
    () => (existingLeave?.leave_day_assignments ?? []).length > 0,
  )
  const [formError, setFormError] = useState<string | null>(null)

  const { data: allEmployees } = useEmployees(schoolId)
  const { data: allLeaves } = useLeaves(schoolId)
  const rangeValid = !!startDate && !!endDate && endDate >= startDate
  const { data: dashboardData } = useDashboardData(
    schoolId,
    rangeValid && assignSubsInAdvance ? startDate : undefined,
    rangeValid && assignSubsInAdvance ? endDate : undefined,
  )
  const clearAssignment = useClearDailyAssignment()
  const markAbsence = useMarkAbsence()
  const createLeave = useCreateLeave()
  const updateLeave = useUpdateLeave()
  const confirm = useConfirm()

  const allDates = useMemo(() => (rangeValid ? datesInRange(startDate, endDate) : []), [rangeValid, startDate, endDate])

  // ימי החופשה שבהם לעובדת יש בפועל משבצת קבועה (לפי weekday), מפורק למשבצת בודדת (כיתה+חלק
  // יום) לכל שורה — רק אלה מוצגים לשיוך מ"מ מראש
  const dateGroups: DateGroup[] = useMemo(() => {
    if (!dashboardData) return []
    const groups: DateGroup[] = []
    for (const date of allDates) {
      const weekday = systemWeekday(parseISODate(date))
      const rows: SlotRow[] = []
      for (const c of dashboardData.classes) {
        for (const s of c.slots) {
          if (s.weekday === weekday && s.assigned_employee_id === employee.id) {
            rows.push({ slotId: s.id, className: c.classRow.name, dayPart: s.day_part })
          }
        }
      }
      if (rows.length > 0) groups.push({ date, weekday, rows })
    }
    return groups
  }, [dashboardData, allDates, employee.id])

  // מסנן את החופשה הנוכחית (בעריכה) מהקשר הפתרון, כדי ששיוכי המ"מ שכבר נשמרו לה לא ידווחו
  // כ"כפילות" מול עצמם
  const leavesForCtx = useMemo(
    () => (dashboardData?.leaves ?? []).filter((l) => l.id !== existingLeave?.id),
    [dashboardData, existingLeave],
  )
  const ctx = useMemo(
    () => (dashboardData ? buildResolveContext(dashboardData.absences, leavesForCtx, dashboardData.dailyAssignments) : null),
    [dashboardData, leavesForCtx],
  )
  const occupancyMap = useMemo(
    () =>
      dashboardData && ctx
        ? computeOccupancyMap(dashboardData.classes, allDates, ctx)
        : new Map<string, SlotOccupancy>(),
    [dashboardData, ctx, allDates],
  )

  // מנקה שיוכי מ"מ למשבצות שכבר לא נופלות בטווח הנבחר (אחרי שינוי תאריכים)
  useEffect(() => {
    const validKeys = new Set(dateGroups.flatMap((g) => g.rows.map((r) => dayAssignmentKey(g.date, r.slotId))))
    setSlotAssignments((prev) => {
      const next: Record<string, number> = {}
      for (const [key, empId] of Object.entries(prev)) {
        if (validKeys.has(key)) next[key] = empId
      }
      return next
    })
  }, [dateGroups])

  // ביטול השיוך מראש מנקה את כל הבחירות שנעשו (הימים חוזרים להיות "פתוחים")
  useEffect(() => {
    if (!assignSubsInAdvance) setSlotAssignments({})
  }, [assignSubsInAdvance])

  async function handleSelectSub(date: string, row: SlotRow, employeeId: number) {
    const conflict = occupancyMap.get(occupancyKey(date, row.dayPart, employeeId))

    if (conflict) {
      if (conflict.kind === 'filled_leave_sub') {
        alert('עובדת זו כבר שויכה מראש כמ"מ דרך חופשה אחרת לאותה משבצת — יש לערוך משם.')
        return
      }
      const employeeName = allEmployees?.find((e) => e.id === employeeId)?.full_name ?? ''
      const ok = await confirm(
        buildTransferConfirmMessage(
          employeeName,
          `ב${conflict.className} ${DAY_PART_LABELS[conflict.dayPart]} בתפקיד "${conflict.role}" באותו תאריך`,
        ),
      )
      if (!ok) return

      try {
        if (conflict.kind === 'filled_sub' && conflict.assignmentId) {
          await clearAssignment.mutateAsync({ schoolId, assignmentId: conflict.assignmentId })
        } else if (conflict.kind === 'filled_permanent') {
          await markAbsence.mutateAsync({ schoolId, employeeId, date, dayPart: conflict.dayPart, reportedBy: createdBy })
        }
      } catch (error) {
        alert(`פינוי השיבוץ הקודם נכשל: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`)
        return
      }
    }

    setSlotAssignments((prev) => ({ ...prev, [dayAssignmentKey(date, row.slotId)]: employeeId }))
  }

  function clearSlotAssignment(date: string, slotId: number) {
    setSlotAssignments((prev) => {
      const next = { ...prev }
      delete next[dayAssignmentKey(date, slotId)]
      return next
    })
  }

  const isSaving = createLeave.isPending || updateLeave.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!existingLeave && startDate < today) {
      setFormError('לא ניתן לרשום חופשה שמתחילה בעבר')
      return
    }
    if (endDate < startDate) {
      setFormError('תאריך הסיום חייב להיות אחרי תאריך ההתחלה')
      return
    }
    if (!reminderDaysBefore || reminderDaysBefore < 0) {
      setFormError('יש להזין מספר ימים תקין לתזכורת')
      return
    }
    const overlap = (allLeaves ?? []).some(
      (l) =>
        l.employee_id === employee.id &&
        l.status === 'active' &&
        l.id !== existingLeave?.id &&
        startDate <= l.end_date &&
        endDate >= l.start_date,
    )
    if (overlap) {
      setFormError('לעובדת זו כבר קיימת חופשה פעילה החופפת לטווח שנבחר')
      return
    }

    const input: LeaveFormInput = {
      employeeId: employee.id,
      startDate,
      endDate,
      reminderDaysBefore,
      notes: notes.trim() || null,
    }
    const dayAssignmentsInput: LeaveDayAssignmentInput[] = Object.entries(slotAssignments).map(([key, empId]) => {
      const [assignmentDate, slotIdStr] = key.split(':')
      return { assignmentDate, slotId: Number(slotIdStr), employeeId: empId }
    })

    try {
      if (existingLeave) {
        await updateLeave.mutateAsync({
          schoolId,
          leaveId: existingLeave.id,
          input,
          dayAssignments: dayAssignmentsInput,
        })
      } else {
        await createLeave.mutateAsync({ schoolId, input, dayAssignments: dayAssignmentsInput })
      }
      onClose()
    } catch {
      setFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
      <div className="flex max-h-full w-full max-w-[560px] flex-col rounded-xl border border-line bg-panel p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold">
          {existingLeave ? 'עריכת חופשה' : 'הוספת חופשה'} — {employee.full_name}
        </h2>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-[13px] text-ink-soft">תאריך התחלה</span>
              <input
                type="date"
                value={startDate}
                min={existingLeave ? undefined : today}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-[13px] text-ink-soft">תאריך סיום מתוכנן</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[13px] text-ink-soft">ימים לפני החזרה לתזכורת</span>
            <div className="flex items-center gap-2">
              {REMINDER_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReminderDaysBefore(preset)}
                  className={`rounded-md border px-2.5 py-1 text-[12.5px] ${
                    reminderDaysBefore === preset
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line hover:bg-[#f2f0ea]'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <input
                type="number"
                min={0}
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
                className="w-20 rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] outline-none focus:border-accent"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-[13px] text-ink-soft">הערות</span>
            <textarea
              value={notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
            />
          </label>

          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input
                type="checkbox"
                checked={assignSubsInAdvance}
                onChange={(e) => setAssignSubsInAdvance(e.target.checked)}
              />
              לשייך מ"מ מראש למשבצות ספציפיות בטווח? (אופציונלי)
            </label>
            {assignSubsInAdvance && (
              <>
                <div className="mb-2 mt-1 text-[11.5px] text-ink-soft">
                  כל משבצת (כיתה + בוקר/צהריים) משויכת בנפרד — אפשר לשייך מ"מ רק לצהריים ולהשאיר
                  את הבוקר פתוח, למשל. משבצות שלא תשויך להן מ"מ יישארו פתוחות לשיבוץ יומי רגיל.
                </div>
                <div className="flex flex-col gap-2.5">
                  {!rangeValid ? (
                    <div className="rounded-md border border-line px-2.5 py-2 text-[12px] text-ink-soft">
                      יש לבחור טווח תאריכים תקין.
                    </div>
                  ) : dateGroups.length === 0 ? (
                    <div className="rounded-md border border-line px-2.5 py-2 text-[12px] text-ink-soft">
                      אין לעובדת משבצות קבועות בטווח שנבחר.
                    </div>
                  ) : (
                    dateGroups.map((group) => (
                      <div key={group.date} className="rounded-md border border-line px-2.5 py-1.5">
                        <div className="mb-1 text-[12px] font-medium">
                          {WEEKDAY_LABELS[group.weekday]} {toGregorianDateLabel(parseISODate(group.date))}
                        </div>
                        <div className="flex flex-col gap-1">
                          {group.rows.map((row) => {
                            const assignedId = slotAssignments[dayAssignmentKey(group.date, row.slotId)]
                            const assignedEmployee = assignedId
                              ? allEmployees?.find((e) => e.id === assignedId)
                              : null
                            return (
                              <div key={row.slotId} className="flex items-center justify-between gap-2 text-[12px]">
                                <div className="min-w-0 flex-1 truncate text-ink-soft">
                                  {row.className} - {DAY_PART_LABELS[row.dayPart]}
                                </div>
                                <div className="w-44 shrink-0">
                                  {assignedEmployee ? (
                                    <div className="flex items-center justify-between gap-1 rounded border border-line bg-white px-1.5 py-1">
                                      <span className="truncate text-[12px]">
                                        <EmployeeHoverCard employee={assignedEmployee}>
                                          {assignedEmployee.full_name}
                                        </EmployeeHoverCard>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => clearSlotAssignment(group.date, row.slotId)}
                                        className="shrink-0 text-[11px] text-danger hover:opacity-70"
                                      >
                                        הסרה
                                      </button>
                                    </div>
                                  ) : (
                                    <SubstituteCombobox
                                      employees={allEmployees ?? []}
                                      getOccupancy={(empId) =>
                                        occupancyMap.get(occupancyKey(group.date, row.dayPart, empId)) ?? null
                                      }
                                      onSelect={(empId) => handleSelectSub(group.date, row, empId)}
                                    />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {formError && (
            <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{formError}</div>
          )}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isSaving ? 'שומרת…' : 'שמירה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
