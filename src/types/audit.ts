export type AuditAction = 'create' | 'update' | 'delete'

// entity_type הוא תמיד שם הטבלה (TG_TABLE_NAME) — כרגע רק הטבלאות שהדשבורד/הקייטנה כותבים
// אליהן מחוברות לטריגר (ראו מיגרציית log_audit_event): daily_assignments, daily_absences
export type AuditEntityType = 'daily_assignments' | 'daily_absences'

export interface AuditLogRow {
  id: number
  school_id: number
  entity_type: AuditEntityType
  entity_id: number
  action: AuditAction
  old_value: Record<string, any> | null
  new_value: Record<string, any> | null
  changed_by: string | null
  changed_at: string
}

export interface AuditLogWithUser extends AuditLogRow {
  changed_by_profile: { full_name: string } | null
}
