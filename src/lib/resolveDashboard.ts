import type { DayPart, TemplateSlotWithEmployee } from '../types/schedule'
import type {
  DailyAbsenceRow,
  DailyAssignmentRow,
  DailySlotUrgencyRow,
  EmployeeLeaveRow,
  LeaveDayAssignmentRow,
  SlotDayStatus,
  SlotOccupancy,
} from '../types/dashboard'
import type { AuxiliarySystemWithRoster } from '../hooks/useAuxiliarySystems'
import type { DailyAuxiliaryAssignmentRow, StaffSourceMode } from '../types/auxiliary'
import type { EmployeeWithType } from '../hooks/useEmployees'
import { parseISODate, systemWeekday } from './dateUtils'

// "הקשר פתרון" — מבני עזר (Map/Set) בנויים פעם אחת מהנתונים שנשלפו לטווח הנבחר,
// כדי שפתרון כל תא יהיה חיפוש O(1) ולא סריקה חוזרת.
export interface ResolveContext {
  // `${employeeId}:${date}:${dayPart|'all'}` — 'all' מייצג רשומה ישנה של יום שלם (day_part null)
  absenceSet: Set<string>
  leavesByEmployee: Map<number, EmployeeLeaveRow[]>
  leaveSubBySlotDate: Map<string, LeaveDayAssignmentRow> // key: `${slotId}:${date}`
  dailyAssignBySlotDate: Map<string, DailyAssignmentRow> // key: `${slotId}:${date}`
  urgencyBySlotDate: Map<string, DailySlotUrgencyRow> // key: `${slotId}:${date}`
}

export function buildResolveContext(
  absences: DailyAbsenceRow[],
  leaves: EmployeeLeaveRow[],
  dailyAssignments: DailyAssignmentRow[],
  urgencyOverrides: DailySlotUrgencyRow[] = [],
): ResolveContext {
  const absenceSet = new Set(absences.map((a) => `${a.employee_id}:${a.absence_date}:${a.day_part ?? 'all'}`))

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

  const urgencyBySlotDate = new Map<string, DailySlotUrgencyRow>()
  for (const u of urgencyOverrides) {
    urgencyBySlotDate.set(`${u.slot_id}:${u.assignment_date}`, u)
  }

  return { absenceSet, leavesByEmployee, leaveSubBySlotDate, dailyAssignBySlotDate, urgencyBySlotDate }
}

function isOnLeave(ctx: ResolveContext, employeeId: number, date: string): boolean {
  const leaves = ctx.leavesByEmployee.get(employeeId)
  if (!leaves) return false
  return leaves.some((l) => l.start_date <= date && date <= l.end_date)
}

// היעדרות חד-פעמית בתאריך זה: אם dayPart מצוין, בודקת רק אותו חלק-יום (בנוסף לרשומות "יום
// שלם" ישנות) — כדי שהיעדרות שסומנה על חלק-יום אחד (למשל צהריים) לא תשפיע על החלק השני (בוקר)
// באותה כיתה/תפקיד. בלי dayPart (משמש לבדיקות ברמת "כל היום", כמו מועמדות למ"מ ממקור "all"),
// בודקת אם יש היעדרות בכלל, לא משנה לאיזה חלק-יום.
function hasAbsence(ctx: ResolveContext, employeeId: number, date: string, dayPart?: DayPart): boolean {
  if (dayPart) {
    return ctx.absenceSet.has(`${employeeId}:${date}:${dayPart}`) || ctx.absenceSet.has(`${employeeId}:${date}:all`)
  }
  return (
    ctx.absenceSet.has(`${employeeId}:${date}:morning`) ||
    ctx.absenceSet.has(`${employeeId}:${date}:afternoon`) ||
    ctx.absenceSet.has(`${employeeId}:${date}:all`)
  )
}

// נעדרת (היעדרות חד-פעמית) או בחופשה בתאריך זה — משמש גם לפתרון תא כיתה (למעלה) וגם לזיהוי
// "חור פתיחה" (למטה), כדי ששני המקומות יתבססו על אותה הגדרת זמינות.
export function isEmployeeUnavailable(ctx: ResolveContext, employeeId: number, date: string, dayPart?: DayPart): boolean {
  return hasAbsence(ctx, employeeId, date, dayPart) || isOnLeave(ctx, employeeId, date)
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
    const isAbsent = hasAbsence(ctx, baseEmployeeId, date, slot.day_part)
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

  const override = ctx.urgencyBySlotDate.get(`${slot.id}:${date}`)
  const effectiveCriticality = override?.urgency ?? slot.criticality

  if (effectiveCriticality === 'not_required') {
    return { kind: 'not_required', isUrgencyOverridden: !!override }
  }
  return {
    kind: 'missing',
    criticality: effectiveCriticality,
    isUrgencyOverridden: !!override,
  }
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

// מי בפועל נמצאת בבניין בחלק-יום נתון (בכל כיתה שהיא) בתאריך קונקרטי — אחרי פתרון היעדרויות/
// חופשות/מ"מ יומיים לאותו תאריך ספציפי. שונה מ-useStaffByWeekday (המשמש את מסך "מערכות עזר"),
// שמבוסס רק על השיבוץ השבועי הסטטי ולכן עלול לכלול מי שהיום הזה עצמה נעדרת/הועברה לכיסוי אחר.
// משמש לרשימת המועמדות למ"מ חד-פעמי במערכת עזר (5.7-ג המורחב) — dayPart נקבע לפי
// AuxiliarySystemRow.source_day_part של אותה מערכת.
export function computePresenceByDate(
  classes: { slots: TemplateSlotWithEmployee[] }[],
  dates: string[],
  ctx: ResolveContext,
  dayPart: DayPart,
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>()
  for (const date of dates) {
    const weekday = systemWeekday(parseISODate(date))
    const present = new Set<number>()
    for (const classData of classes) {
      for (const slot of classData.slots) {
        if (slot.weekday !== weekday || slot.day_part !== dayPart) continue
        const status = resolveSlotStatus(slot, date, ctx)
        if (
          status.kind === 'filled_permanent' ||
          status.kind === 'filled_sub' ||
          status.kind === 'filled_leave_sub'
        ) {
          present.add(status.employeeId)
        }
      }
    }
    map.set(date, present)
  }
  return map
}

// כל העובדות הפעילות שאינן נעדרות/בחופשה בתאריך קונקרטי — מקביל ל-computePresenceByDate אבל
// למקור צוות "all" (כל העובדות, בלי הגבלה לפי שיבוץ קיים בזמן מסוים).
export function computeAllActivePresenceByDate(
  employees: EmployeeWithType[],
  dates: string[],
  ctx: ResolveContext,
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>()
  for (const date of dates) {
    const present = new Set<number>()
    for (const emp of employees) {
      if (emp.active && !isEmployeeUnavailable(ctx, emp.id, date)) present.add(emp.id)
    }
    map.set(date, present)
  }
  return map
}

// תפוסה קיימת (למחסום/אישור-העברה) עבור מועמדת לחור במערכת עזר, לפי מקור הצוות של המערכת:
// חלק-יום ספציפי בודק רק שם; "all" בודק גם בוקר וגם צהריים (איחוד), כי אין חלק-יום יחיד רלוונטי.
export function auxiliaryOccupancy(
  occupancyMap: Map<string, SlotOccupancy>,
  date: string,
  sourceDayPart: StaffSourceMode,
  employeeId: number,
): SlotOccupancy | null {
  if (sourceDayPart === 'all') {
    return (
      occupancyMap.get(occupancyKey(date, 'morning', employeeId)) ??
      occupancyMap.get(occupancyKey(date, 'afternoon', employeeId)) ??
      null
    )
  }
  return occupancyMap.get(occupancyKey(date, sourceDayPart, employeeId)) ?? null
}

// "חור" במערכת עזר (פתיחה/סגירה/וכל מה שבית הספר יגדיר) לתאריך קונקרטי: תפקיד שאין לו כיסוי
// בפועל באותו יום — או כי הוא לא מאויש בכלל בשיבוץ השבועי (absentEmployeeId: null), או כי הוא
// כן מאויש אבל העובדת המשובצת נעדרת/בחופשה באותו תאריך בלבד. מטופל כחור אחיד (5.7-ג המורחב) —
// בשני המקרים אפשר לשבץ מ"מ ישירות דרך daily_auxiliary_assignments, בלי לגעת בשיבוץ השבועי
// הקבוע במסך "מערכות עזר". מחושב רק עבור מערכות עם show_in_missing=true.
export interface AuxiliaryGap {
  date: string
  weekday: number
  systemId: number
  systemName: string
  sourceDayPart: StaffSourceMode
  roleId: number
  roleName: string
  absentEmployeeId: number | null
  dailyAssignment?: DailyAuxiliaryAssignmentRow
}

export function computeAuxiliaryGaps(
  systemsWithRoster: AuxiliarySystemWithRoster[],
  dates: string[],
  ctx: ResolveContext,
  dailyAssignments: DailyAuxiliaryAssignmentRow[],
): AuxiliaryGap[] {
  const byRoleDate = new Map<string, DailyAuxiliaryAssignmentRow>()
  for (const a of dailyAssignments) byRoleDate.set(`${a.role_id}:${a.assignment_date}`, a)

  const result: AuxiliaryGap[] = []
  for (const date of dates) {
    const weekday = systemWeekday(parseISODate(date))
    if (weekday === 7) continue // שבת — מסך "מערכות עזר" מנהל רק ימים 1-6, אין שם מה לאייש
    for (const { system, roles } of systemsWithRoster) {
      if (!system.show_in_missing) continue
      for (const role of roles) {
        const assignedId = role.assignments[weekday]?.employee_id ?? null
        const isGap =
          assignedId === null ||
          isEmployeeUnavailable(
            ctx,
            assignedId,
            date,
            system.source_day_part === 'all' ? undefined : system.source_day_part,
          )
        if (!isGap) continue
        result.push({
          date,
          weekday,
          systemId: system.id,
          systemName: system.name,
          sourceDayPart: system.source_day_part,
          roleId: role.id,
          roleName: role.name,
          absentEmployeeId: assignedId,
          dailyAssignment: byRoleDate.get(`${role.id}:${date}`),
        })
      }
    }
  }
  return result
}
