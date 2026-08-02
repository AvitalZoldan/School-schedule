export type DayPart = 'morning' | 'afternoon'
export type Criticality = 'critical' | 'normal' | 'not_required'
export type SlotType = 'fixed' | 'variable'
export type TemplateMode = 'regular' | 'camp'
export type TemplateStatus = 'active' | 'draft'
export type EmployeeStatus = 'permanent' | 'substitute'

export interface SchoolRow {
  id: number
  name: string
  active: boolean
  max_full_access_users: number
}

export interface ClassRow {
  id: number
  school_id: number
  name: string
  active: boolean
}

export interface EmployeeRow {
  id: number
  school_id: number
  full_name: string
  employee_type_id: number
  phone: string | null
  email: string | null
  status: EmployeeStatus // קבועה / מ"מ — סעיף 3.1
  is_preferred: boolean // מועדפת (רלוונטי למ"מ)
  notes: string | null
  active: boolean
  category_id: number | null
}

export interface EmployeeTypeRow {
  id: number
  school_id: number
  code: string
  label: string
  sort_order: number
  active: boolean
}

// קטגוריית עובדות מוגדרת-בית-ספר (עם צבע לתצוגה) — נערכת במסך "ניהול"
export interface EmployeeCategoryRow {
  id: number
  school_id: number
  name: string
  color: string
  sort_order: number
  active: boolean
}

// תפקיד מוגדר-בית-ספר (למשל מורה/סייעת/בת שירות) — נערך במסך "ניהול", ראו RoleTypeDefaultRow
export interface RoleTypeRow {
  id: number
  school_id: number
  name: string
  sort_order: number
  active: boolean
}

// כמות וקריטיות ברירת מחדל של תפקיד לחלק-יום נתון — נצרך ביצירת כיתה חדשה
export interface RoleTypeDefaultRow {
  id: number
  school_id: number
  role_type_id: number
  day_part: DayPart
  count: number
  criticality: Criticality
}

export interface ScheduleTemplateRow {
  id: number
  school_id: number
  class_id: number
  mode: TemplateMode
  status: TemplateStatus
  based_on_template_id: number | null
  replaced_template_id: number | null
  created_at: string
  applied_at: string | null
}

export interface TemplateSlotRow {
  id: number
  template_id: number
  weekday: number // 1..6, 1=ראשון
  day_part: DayPart
  role: string
  slot_type: SlotType
  criticality: Criticality
  assigned_employee_id: number | null
}

// חור מועשר בשם העובדת, לשימוש בתצוגה (ה-JOIN מתבצע בשאילתה)
export interface TemplateSlotWithEmployee extends TemplateSlotRow {
  employee: Pick<EmployeeRow, 'id' | 'full_name'> | null
  notes: string | null
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'ראשון',
  2: 'שני',
  3: 'שלישי',
  4: 'רביעי',
  5: 'חמישי',
  6: 'שישי',
}

export const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: 'בוקר',
  afternoon: 'צהריים',
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  permanent: 'קבועה',
  substitute: 'מ"מ',
}
