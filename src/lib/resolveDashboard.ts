import type { DayPart, TemplateSlotWithEmployee } from '../types/schedule'
import type {
  DailyAbsenceRow,
  DailyAssignmentRow,
  EmployeeLeaveRow,
  LeaveDayAssignmentRow,
  SlotDayStatus,
  SlotOccupancy,
} from '../types/dashboard'
import { parseISODate, systemWeekday } from './dateUtils'

// "הקשר פתרון" — מבני עזר (Map/Set) בנויים פעם אחת מהנתונים שנשלפו לטווח הנבחר,
// כדי שפתרון כל תא יהיה חיפוש O(1) ולא סריקה חוזרת.
export interface ResolveContext {
  absenceSet: Set<string> // `${employeeId}:${date}`
  leavesByEmployee: Map<number, EmployeeLeaveRow[]>
  leaveSubBySlotDate: Map<string, LeaveDayAssignmentRow> // key: `${slotId}:${date}`
  dailyAssignBySlotDate: Map<string, DailyAssignmentRow> // key: `${slotId}:${date}`
}

export function buildResolveContext(
  absences: DailyAbsenceRow[],
  leaves: EmployeeLeaveRow[],
  dailyAssignments: DailyAssignmentRow[],
): ResolveContext {
  const absenceSet = new Set(absences.map((a) => `${a.employee_id}:${a.absence_date}`))

  const leavesByEmployee = new Map<number, EmployeeLeaveRow[]>()
  const leaveSubBySlotDate = new Map<string, LeaveDayAssignmentRow>()
  for (const leave of leaves) {
    if (!leavesByEmployee.has(leave.employee_id)) leavesByEmployee.set(leave.employee_id, [])
    leavesByEmployee.get(leave.employee_id)!.push(leave)
    for (const dayAssign of leave.leave_day_assignments ?? []) {
      leaveSubBySlotDate.set(`${dayAssign.slot_id}:${dayAssign.assignment_date}`, dayAssign)
    }
  }

  const dailyAssignBySlotDate = new Map<string, DailyAssignmentRow>()
  for (const da of dailyAssignments) {
    dailyAssignBySlotDate.set(`${da.slot_id}:${da.assignment_date}`, da)
  }

  return { absenceSet, leavesByEmployee, leaveSubBySlotDate, dailyAssignBySlotDate }
}

function isOnLeave(ctx: ResolveContext, employeeId: number, date: string): boolean {
  const leaves = ctx.leavesByEmployee.get(employeeId)
  if (!leaves) return false
  return leaves.some((l) => l.start_date <= date && date <= l.end_date)
}

// פותר חור בודד לתאריך קונקרטי — הלב של "דאשבורד + ניהול חוסרים" (5.2).
// שים לב: כל ה-lookups כאן ממוינים לפי date קונקרטי (לא weekday), כך ששיבוץ/היעדרות
// חד-פעמית שנשלפה לטווח של השבוע הזה, לעולם לא "תדלוף" לטווח של שבוע אחר.
export function resolveSlotStatus(
  slot: TemplateSlotWithEmployee,
  date: string,
  ctx: ResolveContext,
): SlotDayStatus {
  const baseEmployeeId = slot.assigned_employee_id

  if (baseEmployeeId) {
    const isAbsent = ctx.absenceSet.has(`${baseEmployeeId}:${date}`)
    const onLeave = isOnLeave(ctx, baseEmployeeId, date)

    if (!isAbsent && !onLeave) {
      return { kind: 'filled_permanent', employeeId: baseEmployeeId }
    }

    if (onLeave) {
      const leaveSub = ctx.leaveSubBySlotDate.get(`${slot.id}:${date}`)
      if (leaveSub) {
        return { kind: 'filled_leave_sub', employeeId: leaveSub.employee_id }
      }
    }
  }

  // חור משתנה (ריק תמידית), או חור קבוע שהתפנה היום (היעדרות/חופשה) בלי מ"מ משוייכת מראש
  const dailyAssign = ctx.dailyAssignBySlotDate.get(`${slot.id}:${date}`)
  if (dailyAssign) {
    return { kind: 'filled_sub', employeeId: dailyAssign.employee_id, assignmentId: dailyAssign.id }
  }

  if (slot.criticality === 'not_required') return { kind: 'not_required' }
  return { kind: 'missing', criticality: slot.criticality }
}

// לכל (תאריך, חלק-יום, עובדת) שכבר תפוסה בפועל (בכל כיתה שהיא) — היכן בדיוק היא משובצת.
// משמש לזיהוי כפילות (כלל 4.1) ולאפשור "העברה" של עובדת מחור אחד לאחר, במקום להסתיר אותה
// מרשימת הבחירה: כשבוחרים עובדת שכבר תפוסה, מציגים אישור להעביר אותה מהחור הישן לחדש.
export function computeOccupancyMap(
  classes: { classRow: { name: string }; slots: TemplateSlotWithEmployee[] }[],
  dates: string[],
  ctx: ResolveContext,
): Map<string, SlotOccupancy> {
  const map = new Map<string, SlotOccupancy>()
  for (const date of dates) {
    const weekday = systemWeekday(parseISODate(date))
    for (const classData of classes) {
      for (const slot of classData.slots) {
        if (slot.weekday !== weekday) continue
        const status = resolveSlotStatus(slot, date, ctx)
        if (
          status.kind === 'filled_permanent' ||
          status.kind === 'filled_sub' ||
          status.kind === 'filled_leave_sub'
        ) {
          const key = `${date}:${slot.day_part}:${status.employeeId}`
          if (!map.has(key)) {
            map.set(key, {
              employeeId: status.employeeId,
              kind: status.kind,
              className: classData.classRow.name,
              role: slot.role,
              dayPart: slot.day_part,
              assignmentId: status.kind === 'filled_sub' ? status.assignmentId : undefined,
            })
          }
        }
      }
    }
  }
  return map
}

export function occupancyKey(date: string, dayPart: DayPart, employeeId: number): string {
  return `${date}:${dayPart}:${employeeId}`
}
