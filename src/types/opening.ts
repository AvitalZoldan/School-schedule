export interface OpeningRoleRow {
  id: number
  school_id: number
  name: string
  sort_order: number
  active: boolean
}

export interface OpeningAssignmentRow {
  id: number
  school_id: number
  role_id: number
  weekday: number
  employee_id: number | null
  camp_id: number | null // null = שנה רגילה (לא קיטנה)
  week_number: number | null // רלוונטי רק כשיש camp_id
  notes: string | null
}

// שורה מועשרת: תפקיד + מפת שיבוצים לפי יום בשבוע, לנוחות התצוגה בטבלה
export interface OpeningRoleWithAssignments extends OpeningRoleRow {
  assignments: Record<number, OpeningAssignmentRow | undefined> // מפתח = weekday (1..6)
}

// מ"מ פתיחה חד-פעמי לתאריך ספציפי — כשהעובדת המשובצת הקבועה (OpeningAssignmentRow) נעדרת/
// בחופשה באותו תאריך בלבד. לא נוגע בשיבוץ השבועי הקבוע.
export interface DailyOpeningAssignmentRow {
  id: number
  school_id: number
  role_id: number
  opening_date: string
  employee_id: number
  created_by: string | null
  created_at: string
}
