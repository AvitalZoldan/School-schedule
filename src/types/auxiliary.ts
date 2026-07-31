import type { DayPart } from './schedule'

// מקור צוות המועמדות למערכת עזר: חלק-יום ספציפי (רק מי שמשובצת אז), או "all" — כל העובדות
// הפעילות, בלי הגבלה לפי שיבוץ קיים בזמן מסוים
export type StaffSourceMode = DayPart | 'all'

// מערכת עזר מוגדרת-בית-ספר (למשל "מערכת פתיחות"/"מערכת סגירות") — שם, מקור צוות המועמדות
// (בוקר/צהריים/כל העובדות) והאם להציג חורים שלה בדשבורד/שיבוץ מ"מ. ראו מסך "מערכות עזר".
export interface AuxiliarySystemRow {
  id: number
  school_id: number
  name: string
  source_day_part: StaffSourceMode
  show_in_missing: boolean
  sort_order: number
  active: boolean
}

export interface AuxiliaryRoleRow {
  id: number
  school_id: number
  system_id: number
  name: string
  sort_order: number
  active: boolean
}

export interface AuxiliaryAssignmentRow {
  id: number
  school_id: number
  role_id: number
  weekday: number
  employee_id: number | null
  camp_id: number | null // null = שנה רגילה (לא קייטנה)
  week_number: number | null // רלוונטי רק כשיש camp_id
  notes: string | null
}

// שורה מועשרת: תפקיד + מפת שיבוצים לפי יום בשבוע, לנוחות התצוגה בטבלה
export interface AuxiliaryRoleWithAssignments extends AuxiliaryRoleRow {
  assignments: Record<number, AuxiliaryAssignmentRow | undefined> // מפתח = weekday (1..6)
}

// מ"מ חד-פעמי לתאריך ספציפי — כשהעובדת המשובצת הקבועה (AuxiliaryAssignmentRow) נעדרת/
// בחופשה באותו תאריך בלבד. לא נוגע בשיבוץ השבועי הקבוע.
export interface DailyAuxiliaryAssignmentRow {
  id: number
  school_id: number
  role_id: number
  assignment_date: string
  employee_id: number
  created_by: string | null
  created_at: string
}
