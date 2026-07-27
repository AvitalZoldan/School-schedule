import type { DayPart } from './schedule'

export interface DailyAssignmentRow {
  id: number
  school_id: number
  slot_id: number
  assignment_date: string // YYYY-MM-DD
  employee_id: number
  class_id_snapshot: number
  role_snapshot: string
  day_part_snapshot: DayPart
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface DailyAbsenceRow {
  id: number
  school_id: number
  employee_id: number
  absence_date: string
  reported_by: string | null
  reported_at: string
  notes: string | null
}

export interface LeaveDayAssignmentRow {
  id: number
  school_id: number
  leave_id: number
  assignment_date: string
  slot_id: number // המשבצת הספציפית (כיתה+חלק יום) — מאפשר מ"מ שונה לבוקר/צהריים באותו יום
  employee_id: number
}

export interface EmployeeLeaveRow {
  id: number
  school_id: number
  employee_id: number
  start_date: string
  end_date: string
  reminder_days_before: number
  reminder_dismissed: boolean
  notes: string | null
  status: 'active' | 'cancelled'
  leave_day_assignments?: LeaveDayAssignmentRow[]
}

// תוצאת "פתרון" חור עבור תאריך ספציפי — סעיף 3.6/3.7 באפיון
// "no_slot" (למשל צהריים בשישי) מטופל ברמת ClassGrid לפני קריאה ל-resolveSlotStatus,
// ולכן אינו חלק מהטיפוס הזה — resolveSlotStatus תמיד מקבל slot קיים.
export type SlotDayStatus =
  | { kind: 'not_required' }
  | { kind: 'filled_permanent'; employeeId: number }
  | { kind: 'filled_sub'; employeeId: number; assignmentId: number }
  | { kind: 'filled_leave_sub'; employeeId: number }
  | { kind: 'missing'; criticality: 'critical' | 'normal' }

// היכן עובדת מסוימת כבר תפוסה בפועל, לתאריך+חלק-יום נתונים — לשימוש בזרימת "העברה" (ראו
// resolveDashboard.computeOccupancyMap ו-DashboardSlotCell)
export interface SlotOccupancy {
  employeeId: number
  kind: 'filled_permanent' | 'filled_sub' | 'filled_leave_sub'
  className: string
  role: string
  dayPart: DayPart
  assignmentId?: number // רלוונטי רק כש-kind === 'filled_sub', לניקוי daily_assignments
}
