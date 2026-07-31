import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { EmployeeWithType } from './useEmployees'
import type {
  AuxiliaryAssignmentRow,
  AuxiliaryRoleRow,
  AuxiliaryRoleWithAssignments,
  AuxiliarySystemRow,
  DailyAuxiliaryAssignmentRow,
  StaffSourceMode,
} from '../types/auxiliary'

const WEEKDAYS_1_TO_6 = [1, 2, 3, 4, 5, 6]

// מערכות עזר פעילות בלבד (5.7 המורחב) — פתיחות/סגירות/וכל מה שבית הספר יגדיר, לפי סדר תצוגה
export function useAuxiliarySystems(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['auxiliary-systems', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auxiliary_systems')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as AuxiliarySystemRow[]
    },
  })
}

// כולל לא-פעילות — למסך "מערכות עזר" (ניהול המערכות עצמן)
export function useAuxiliarySystemsOverview(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['auxiliary-systems-overview', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auxiliary_systems')
        .select('*')
        .eq('school_id', schoolId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as AuxiliarySystemRow[]
    },
  })
}

function invalidateSystems(queryClient: ReturnType<typeof useQueryClient>, schoolId: number) {
  queryClient.invalidateQueries({ queryKey: ['auxiliary-systems', schoolId] })
  queryClient.invalidateQueries({ queryKey: ['auxiliary-systems-overview', schoolId] })
  queryClient.invalidateQueries({ queryKey: ['auxiliary-all-rosters', schoolId] })
}

interface CreateAuxiliarySystemInput {
  schoolId: number
  name: string
  sourceDayPart: StaffSourceMode
  showInMissing: boolean
  sortOrder: number
}

export function useCreateAuxiliarySystem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, name, sourceDayPart, showInMissing, sortOrder }: CreateAuxiliarySystemInput) => {
      const { data, error } = await supabase
        .from('auxiliary_systems')
        .insert({
          school_id: schoolId,
          name,
          source_day_part: sourceDayPart,
          show_in_missing: showInMissing,
          sort_order: sortOrder,
          active: true,
        })
        .select()
        .single()
      if (error) throw error
      return data as AuxiliarySystemRow
    },
    onSuccess: (_data, variables) => invalidateSystems(queryClient, variables.schoolId),
  })
}

interface UpdateAuxiliarySystemInput {
  systemId: number
  schoolId: number
  name?: string
  sourceDayPart?: StaffSourceMode
  showInMissing?: boolean
  active?: boolean
}

export function useUpdateAuxiliarySystem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ systemId, schoolId: _schoolId, sourceDayPart, showInMissing, ...rest }: UpdateAuxiliarySystemInput) => {
      const patch: Record<string, unknown> = { ...rest }
      if (sourceDayPart !== undefined) patch.source_day_part = sourceDayPart
      if (showInMissing !== undefined) patch.show_in_missing = showInMissing
      const { error } = await supabase.from('auxiliary_systems').update(patch).eq('id', systemId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => invalidateSystems(queryClient, variables.schoolId),
  })
}

export interface CampAuxiliaryContext {
  campId: number
  weekNumber: number
}

// תפקידי מערכת עזר ספציפית, כל אחד עם מפת השיבוצים שלו לפי יום בשבוע — לשנה הרגילה כברירת
// מחדל (camp_id IS NULL). אם מועבר campContext, שולפת את הטבלה השבועית הנפרדת של אותו שבוע
// בתוך הקייטנה — רשימת התפקידים עצמה משותפת לכולם, רק השיבוצים נבדלים.
export function useAuxiliaryRoster(
  schoolId: number | undefined,
  systemId: number | undefined,
  campContext?: CampAuxiliaryContext,
) {
  return useQuery({
    queryKey: ['auxiliary-roster', schoolId, systemId, campContext?.campId, campContext?.weekNumber],
    enabled: !!schoolId && !!systemId && (!campContext || !!campContext.weekNumber),
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('auxiliary_roles')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('system_id', systemId!)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (rolesError) throw rolesError

      const roleIds = (roles ?? []).map((r) => r.id)
      let assignments: AuxiliaryAssignmentRow[] = []
      if (roleIds.length > 0) {
        let query = supabase.from('auxiliary_assignments').select('*').in('role_id', roleIds)
        query = campContext
          ? query.eq('camp_id', campContext.campId).eq('week_number', campContext.weekNumber)
          : query.is('camp_id', null)
        const { data, error } = await query
        if (error) throw error
        assignments = data as AuxiliaryAssignmentRow[]
      }

      return (roles ?? []).map((role): AuxiliaryRoleWithAssignments => {
        const roleAssignments: Record<number, AuxiliaryAssignmentRow | undefined> = {}
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

export interface AuxiliarySystemWithRoster {
  system: AuxiliarySystemRow
  roles: AuxiliaryRoleWithAssignments[]
}

// כל מערכות העזר הפעילות עם תפקידיהן+שיבוציהן (שנה רגילה בלבד), בשליפה אחת — לשימוש בדשבורד
// ובשיבוץ מ"מ, שם צריך לסרוק את כל המערכות במקביל (לא ניתן לקרוא hooks בלולאה)
export function useAllAuxiliaryRosters(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['auxiliary-all-rosters', schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<AuxiliarySystemWithRoster[]> => {
      const { data: systems, error: systemsError } = await supabase
        .from('auxiliary_systems')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (systemsError) throw systemsError

      const systemIds = (systems ?? []).map((s) => s.id)
      if (systemIds.length === 0) return []

      const { data: roles, error: rolesError } = await supabase
        .from('auxiliary_roles')
        .select('*')
        .in('system_id', systemIds)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (rolesError) throw rolesError

      const roleIds = (roles ?? []).map((r) => r.id)
      let assignments: AuxiliaryAssignmentRow[] = []
      if (roleIds.length > 0) {
        const { data, error } = await supabase
          .from('auxiliary_assignments')
          .select('*')
          .in('role_id', roleIds)
          .is('camp_id', null)
        if (error) throw error
        assignments = data as AuxiliaryAssignmentRow[]
      }

      return (systems ?? []).map((system): AuxiliarySystemWithRoster => {
        const systemRoles = (roles as AuxiliaryRoleRow[] | null ?? []).filter((r) => r.system_id === system.id)
        return {
          system,
          roles: systemRoles.map((role): AuxiliaryRoleWithAssignments => {
            const roleAssignments: Record<number, AuxiliaryAssignmentRow | undefined> = {}
            for (const a of assignments) {
              if (a.role_id === role.id && !roleAssignments[a.weekday]) roleAssignments[a.weekday] = a
            }
            return { ...role, assignments: roleAssignments }
          }),
        }
      })
    },
  })
}

// לכל יום בשבוע — רשימת עובדות המועמדות לתפקיד במערכת עזר, לפי מקור הצוות שהוגדר למערכת
// (source_day_part): "morning"/"afternoon" — רק מי שמשובצת לחור כלשהו בכיתה כלשהי, באותו
// חלק-יום (מהשיבוץ הבסיסי הפעיל); "all" — כל העובדות הפעילות של בית הספר, בלי הגבלה לפי שיבוץ
// קיים בזמן מסוים (זהה לכל ימי השבוע).
export function useStaffByWeekday(schoolId: number | undefined, sourceMode: StaffSourceMode | undefined) {
  return useQuery({
    queryKey: ['staff-by-weekday', schoolId, sourceMode],
    enabled: !!schoolId && !!sourceMode,
    queryFn: async () => {
      if (sourceMode === 'all') {
        const { data, error } = await supabase
          .from('employees')
          .select('*, employee_type:employee_types(id, code, label), category:employee_categories(id, name, color)')
          .eq('school_id', schoolId!)
          .eq('active', true)
          .order('full_name', { ascending: true })
        if (error) throw error
        const allActive = data as unknown as EmployeeWithType[]
        const result: Record<number, EmployeeWithType[]> = {}
        for (const wd of WEEKDAYS_1_TO_6) result[wd] = allActive
        return result
      }

      const { data, error } = await supabase
        .from('template_slots')
        .select(
          `weekday,
          employee:employees ( id, full_name, employee_type:employee_types(id, code, label) ),
          schedule_templates!inner ( school_id, mode, status )`,
        )
        .eq('day_part', sourceMode!)
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

interface UpsertAuxiliaryAssignmentInput {
  schoolId: number
  // אם יש כבר שורה (assignment.id ידוע מהשליפה) — מעדכנים אותה.
  // אם אין (התא היה ריק לגמרי) — יוצרים שורה חדשה. אין unique constraint ב-DB,
  // אז מכוונים במפורש update-by-id או insert, ולא סומכים על upsert.
  assignmentId?: number
  roleId: number
  weekday: number
  employeeId: number | null
  notes?: string | null
  campContext?: CampAuxiliaryContext
}

export function useUpsertAuxiliaryAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpsertAuxiliaryAssignmentInput) => {
      if (input.assignmentId) {
        const { error } = await supabase
          .from('auxiliary_assignments')
          .update({ employee_id: input.employeeId, notes: input.notes ?? null })
          .eq('id', input.assignmentId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('auxiliary_assignments').insert({
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
        queryKey: ['auxiliary-roster', variables.schoolId, undefined, variables.campContext?.campId, variables.campContext?.weekNumber],
      })
      queryClient.invalidateQueries({ queryKey: ['auxiliary-roster'] })
      queryClient.invalidateQueries({ queryKey: ['auxiliary-all-rosters', variables.schoolId] })
    },
  })
}

interface CreateAuxiliaryRoleInput {
  schoolId: number
  systemId: number
  name: string
  sortOrder: number
}

// הוספת תפקיד חדש לרשימה הקבועה של מערכת עזר (ניתנת לעריכה)
export function useCreateAuxiliaryRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, systemId, name, sortOrder }: CreateAuxiliaryRoleInput) => {
      const { error } = await supabase
        .from('auxiliary_roles')
        .insert({ school_id: schoolId, system_id: systemId, name, sort_order: sortOrder, active: true })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auxiliary-roster', variables.schoolId, variables.systemId] })
      queryClient.invalidateQueries({ queryKey: ['auxiliary-all-rosters', variables.schoolId] })
    },
  })
}

// שולפת מ"מ חד-פעמיים לכל מערכות העזר של בית הספר בטווח תאריכים נבחר (יום/שבוע נוכחי)
export function useDailyAuxiliaryAssignments(
  schoolId: number | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
) {
  return useQuery({
    queryKey: ['daily-auxiliary-assignments', schoolId, dateFrom, dateTo],
    enabled: !!schoolId && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_auxiliary_assignments')
        .select('*')
        .eq('school_id', schoolId!)
        .gte('assignment_date', dateFrom!)
        .lte('assignment_date', dateTo!)
      if (error) throw error
      return data as DailyAuxiliaryAssignmentRow[]
    },
  })
}

function invalidateDailyAuxiliary(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['daily-auxiliary-assignments'] })
}

interface AssignDailyAuxiliaryInput {
  schoolId: number
  roleId: number
  date: string
  employeeId: number
  createdBy: string | null
}

export function useAssignDailyAuxiliary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AssignDailyAuxiliaryInput) => {
      const { error } = await supabase.from('daily_auxiliary_assignments').insert({
        school_id: input.schoolId,
        role_id: input.roleId,
        assignment_date: input.date,
        employee_id: input.employeeId,
        created_by: input.createdBy,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateDailyAuxiliary(queryClient),
  })
}

interface ClearDailyAuxiliaryInput {
  schoolId: number
  assignmentId: number
}

export function useClearDailyAuxiliary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, assignmentId }: ClearDailyAuxiliaryInput) => {
      const { error } = await supabase
        .from('daily_auxiliary_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('school_id', schoolId)
      if (error) throw error
    },
    onSuccess: () => invalidateDailyAuxiliary(queryClient),
  })
}

