import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { EmployeeWithType } from './useEmployees'
import type {
  DailyOpeningAssignmentRow,
  OpeningAssignmentRow,
  OpeningRoleRow,
  OpeningRoleWithAssignments,
} from '../types/opening'

export function useOpeningRoles(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['opening-roles', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opening_roles')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as OpeningRoleRow[]
    },
  })
}

export interface CampOpeningContext {
  campId: number
  weekNumber: number
}

// תפקידי הפתיחה, כל אחד עם מפת השיבוצים שלו לפי יום בשבוע (1..6) — לשנה הרגילה כברירת מחדל
// (camp_id IS NULL). אם מועבר campContext, שולפת את הטבלה השבועית הנפרדת של אותו שבוע בתוך
// הקייטנה (3.10: "מוגדרת טבלה נפרדת לכל שבוע") — רשימת התפקידים עצמה משותפת לכולם, רק
// השיבוצים נבדלים.
export function useOpeningRoster(schoolId: number | undefined, campContext?: CampOpeningContext) {
  return useQuery({
    queryKey: ['opening-roster', schoolId, campContext?.campId, campContext?.weekNumber],
    enabled: !!schoolId && (!campContext || !!campContext.weekNumber),
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('opening_roles')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (rolesError) throw rolesError

      const roleIds = (roles ?? []).map((r) => r.id)
      let assignments: OpeningAssignmentRow[] = []
      if (roleIds.length > 0) {
        let query = supabase.from('opening_assignments').select('*').in('role_id', roleIds)
        query = campContext
          ? query.eq('camp_id', campContext.campId).eq('week_number', campContext.weekNumber)
          : query.is('camp_id', null)
        const { data, error } = await query
        if (error) throw error
        assignments = data as OpeningAssignmentRow[]
      }

      return (roles ?? []).map((role): OpeningRoleWithAssignments => {
        const roleAssignments: Record<number, OpeningAssignmentRow | undefined> = {}
        for (const a of assignments) {
          // אם קיימות (בטעות, בהיעדר unique constraint) כמה שורות לאותו role+weekday —
          // לוקחים את הראשונה שנמצאת, כדי שהתצוגה לא תישבר.
          if (a.role_id === role.id && !roleAssignments[a.weekday]) {
            roleAssignments[a.weekday] = a
          }
        }
        return { ...role, assignments: roleAssignments }
      })
    },
  })
}

// לכל יום בשבוע — רשימת העובדות המשובצות לחור בוקר כלשהו, בכיתה כלשהי (מהשיבוץ הבסיסי הפעיל).
// זו רשימת הבחירה המוגבלת לתפקידי פתיחה: מי שלא בבניין בבוקר לא יכולה לבצע תפקיד פתיחה.
export function useMorningStaffByWeekday(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['morning-staff-by-weekday', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('template_slots')
        .select(
          `weekday,
          employee:employees ( id, full_name, employee_type:employee_types(id, code, label) ),
          schedule_templates!inner ( school_id, mode, status )`,
        )
        .eq('day_part', 'morning')
        .not('assigned_employee_id', 'is', null)
        .eq('schedule_templates.school_id', schoolId!)
        .eq('schedule_templates.mode', 'regular')
        .eq('schedule_templates.status', 'active')

      if (error) throw error

      const byWeekday = new Map<number, Map<number, EmployeeWithType>>()
      for (const row of (data ?? []) as any[]) {
        const emp = row.employee as EmployeeWithType | null
        if (!emp) continue
        if (!byWeekday.has(row.weekday)) byWeekday.set(row.weekday, new Map())
        byWeekday.get(row.weekday)!.set(emp.id, emp)
      }

      const result: Record<number, EmployeeWithType[]> = {}
      for (const [weekday, employeesMap] of byWeekday.entries()) {
        result[weekday] = [...employeesMap.values()].sort((a, b) =>
          a.full_name.localeCompare(b.full_name, 'he'),
        )
      }
      return result
    },
  })
}

// מ"מ פתיחה חד-פעמיים שנקבעו בפועל בטווח התאריכים הנבחר (כשהעובדת הקבועה נעדרת/בחופשה
// באותו תאריך) — משמש את הדשבורד ואת מסך "שיבוץ מ"מ" כדי לזהות אילו תפקידי פתיחה כבר שובצו
// ואילו עדיין פתוחים.
export function useDailyOpeningAssignments(
  schoolId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
) {
  return useQuery({
    queryKey: ['daily-opening-assignments', schoolId, startDate, endDate],
    enabled: !!schoolId && !!startDate && !!endDate,
    queryFn: async (): Promise<DailyOpeningAssignmentRow[]> => {
      const { data, error } = await supabase
        .from('daily_opening_assignments')
        .select('*')
        .eq('school_id', schoolId!)
        .gte('opening_date', startDate!)
        .lte('opening_date', endDate!)
      if (error) throw error
      return data as DailyOpeningAssignmentRow[]
    },
  })
}

interface AssignDailyOpeningInput {
  schoolId: number
  roleId: number
  date: string
  employeeId: number
  createdBy: string | null
  existingAssignmentId?: number
}

// משבצת מ"מ לתפקיד פתיחה לתאריך קונקרטי — אותה לוגיקת update-by-id/insert כמו
// useAssignDailySlot (אין unique constraint ב-DB, אז לא סומכים על upsert-by-conflict).
export function useAssignDailyOpening() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AssignDailyOpeningInput) => {
      if (input.existingAssignmentId) {
        const { error } = await supabase
          .from('daily_opening_assignments')
          .update({ employee_id: input.employeeId })
          .eq('id', input.existingAssignmentId)
          .eq('school_id', input.schoolId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('daily_opening_assignments').insert({
          school_id: input.schoolId,
          role_id: input.roleId,
          opening_date: input.date,
          employee_id: input.employeeId,
          created_by: input.createdBy,
        })
        if (error) throw error
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-opening-assignments', variables.schoolId] })
    },
  })
}

interface ClearDailyOpeningInput {
  schoolId: number
  assignmentId: number
}

// מבטלת מ"מ פתיחה חד-פעמי שכבר שובץ (מחזירה את התפקיד למצב "פתוח" לאותו תאריך)
export function useClearDailyOpening() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, assignmentId }: ClearDailyOpeningInput) => {
      const { error } = await supabase
        .from('daily_opening_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('school_id', schoolId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily-opening-assignments'] }),
  })
}

interface UpsertOpeningAssignmentInput {
  schoolId: number
  // אם יש כבר שורה (assignment.id ידוע מהשליפה) — מעדכנים אותה.
  // אם אין (התא היה ריק לגמרי) — יוצרים שורה חדשה. אין unique constraint ב-DB,
  // אז מכוונים במפורש update-by-id או insert, ולא סומכים על upsert.
  assignmentId?: number
  roleId: number
  weekday: number
  employeeId: number | null
  notes?: string | null
  campContext?: CampOpeningContext
}

export function useUpsertOpeningAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpsertOpeningAssignmentInput) => {
      if (input.assignmentId) {
        const { error } = await supabase
          .from('opening_assignments')
          .update({ employee_id: input.employeeId, notes: input.notes ?? null })
          .eq('id', input.assignmentId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('opening_assignments').insert({
          school_id: input.schoolId,
          role_id: input.roleId,
          weekday: input.weekday,
          employee_id: input.employeeId,
          camp_id: input.campContext?.campId ?? null,
          week_number: input.campContext?.weekNumber ?? null,
          notes: input.notes ?? null,
        })
        if (error) throw error
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['opening-roster', variables.schoolId, variables.campContext?.campId, variables.campContext?.weekNumber],
      })
    },
  })
}

interface CreateOpeningRoleInput {
  schoolId: number
  name: string
  sortOrder: number
}

// הוספת תפקיד פתיחה חדש לרשימה הקבועה (ניתנת לעריכה לפי סעיף 3.11)
export function useCreateOpeningRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, name, sortOrder }: CreateOpeningRoleInput) => {
      const { error } = await supabase
        .from('opening_roles')
        .insert({ school_id: schoolId, name, sort_order: sortOrder, active: true })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['opening-roster', variables.schoolId] })
      queryClient.invalidateQueries({ queryKey: ['opening-roles', variables.schoolId] })
    },
  })
}
