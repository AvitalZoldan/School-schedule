import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ClassRow, DayPart, TemplateSlotWithEmployee } from '../types/schedule'
import type { DailyAbsenceRow, DailyAssignmentRow, DailySlotUrgencyRow, EmployeeLeaveRow } from '../types/dashboard'

export interface DashboardClassData {
  classRow: ClassRow
  templateId: number | null
  slots: TemplateSlotWithEmployee[]
}

export interface DashboardData {
  classes: DashboardClassData[]
  dailyAssignments: DailyAssignmentRow[]
  absences: DailyAbsenceRow[]
  leaves: EmployeeLeaveRow[]
  urgencyOverrides: DailySlotUrgencyRow[]
}

// שולף את כל מה שדרוש כדי "לפתור" את מצב הכיתות לטווח תאריכים נבחר (יום/שבוע נוכחי, 5.2):
// השיבוץ הבסיסי הפעיל, שיבוצי מ"מ חד-פעמיים (daily_assignments), היעדרויות (daily_absences)
// וחופשות פעילות (employee_leaves + leave_day_assignments) שחופפות את הטווח.
//
// שולף תמיד את **כל** הכיתות הפעילות של בית הספר (לא רק את ההיקף שנבחר לתצוגה) — סינון
// ה"היקף" (כל הכיתות/כיתה ספציפית) נעשה רק בעת התצוגה (ראו Dashboard.tsx), כדי שבדיקת
// הכפילות/תפוסה (computeOccupancyMap) תמיד תראה את התמונה המלאה בבית הספר, גם כשמסתכלים
// על כיתה אחת בלבד — אחרת עובדת שכבר משובצת בכיתה אחרת לא הייתה מתגלה ככפילות.
export function useDashboardData(
  schoolId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
) {
  return useQuery({
    queryKey: ['dashboard', schoolId, startDate, endDate],
    enabled: !!schoolId && !!startDate && !!endDate,
    queryFn: async (): Promise<DashboardData> => {
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('name', { ascending: true })
      if (classesError) throw classesError

      const classIdList = (classesData ?? []).map((c) => c.id)

      const { data: templatesData, error: templatesError } =
        classIdList.length > 0
          ? await supabase
              .from('schedule_templates')
              .select('id, class_id, template_slots(*, employee:employees(id, full_name))')
              .eq('school_id', schoolId!)
              .eq('mode', 'regular')
              .eq('status', 'active')
              .in('class_id', classIdList)
          : { data: [], error: null }
      if (templatesError) throw templatesError

      const classes: DashboardClassData[] = (classesData ?? []).map((c) => {
        const t = (templatesData ?? []).find((t: any) => t.class_id === c.id)
        return {
          classRow: c as ClassRow,
          templateId: t?.id ?? null,
          slots: (t?.template_slots ?? []) as TemplateSlotWithEmployee[],
        }
      })

      const allSlotIds = classes.flatMap((c) => c.slots.map((s) => s.id))

      const [assignmentsRes, absencesRes, leavesRes, urgencyRes] = await Promise.all([
        allSlotIds.length > 0
          ? supabase
              .from('daily_assignments')
              .select('*')
              .eq('school_id', schoolId!)
              .in('slot_id', allSlotIds)
              .gte('assignment_date', startDate!)
              .lte('assignment_date', endDate!)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('daily_absences')
          .select('*')
          .eq('school_id', schoolId!)
          .gte('absence_date', startDate!)
          .lte('absence_date', endDate!),
        supabase
          .from('employee_leaves')
          .select('*, leave_day_assignments(*)')
          .eq('school_id', schoolId!)
          .eq('status', 'active')
          .lte('start_date', endDate!)
          .gte('end_date', startDate!),
        allSlotIds.length > 0
          ? supabase
              .from('daily_slot_urgency')
              .select('*')
              .eq('school_id', schoolId!)
              .in('slot_id', allSlotIds)
              .gte('assignment_date', startDate!)
              .lte('assignment_date', endDate!)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (assignmentsRes.error) throw assignmentsRes.error
      if (absencesRes.error) throw absencesRes.error
      if (leavesRes.error) throw leavesRes.error
      if (urgencyRes.error) throw urgencyRes.error

      return {
        classes,
        dailyAssignments: (assignmentsRes.data ?? []) as DailyAssignmentRow[],
        absences: (absencesRes.data ?? []) as DailyAbsenceRow[],
        leaves: (leavesRes.data ?? []) as EmployeeLeaveRow[],
        urgencyOverrides: (urgencyRes.data ?? []) as DailySlotUrgencyRow[],
      }
    },
  })
}

function invalidateDashboard(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

interface AssignDailySlotInput {
  schoolId: number
  slotId: number
  date: string
  employeeId: number
  classId: number
  role: string
  dayPart: DayPart
  createdBy: string | null
  existingAssignmentId?: number
}

// משבצת מ"מ לחור לתאריך קונקרטי (3.6-ב): אם כבר קיימת שורה לאותו slot+date, מעדכנים אותה,
// אחרת יוצרים חדשה. לא סומכים על upsert-by-conflict כי אין unique constraint מוגדר ב-DB.
export function useAssignDailySlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AssignDailySlotInput) => {
      if (input.existingAssignmentId) {
        const { error } = await supabase
          .from('daily_assignments')
          .update({ employee_id: input.employeeId })
          .eq('id', input.existingAssignmentId)
          .eq('school_id', input.schoolId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('daily_assignments').insert({
          school_id: input.schoolId,
          slot_id: input.slotId,
          assignment_date: input.date,
          employee_id: input.employeeId,
          class_id_snapshot: input.classId,
          role_snapshot: input.role,
          day_part_snapshot: input.dayPart,
          created_by: input.createdBy,
        })
        if (error) throw error
      }
    },
    onSuccess: () => invalidateDashboard(queryClient),
  })
}

interface ClearDailyAssignmentInput {
  schoolId: number
  assignmentId: number
}

// מבטלת שיבוץ מ"מ שכבר בוצע לחור/תאריך (מחזירה את התא למצב "פתוח")
export function useClearDailyAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, assignmentId }: ClearDailyAssignmentInput) => {
      const { error } = await supabase
        .from('daily_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('school_id', schoolId)
      if (error) throw error
    },
    onSuccess: () => invalidateDashboard(queryClient),
  })
}

interface MarkAbsenceInput {
  schoolId: number
  employeeId: number
  date: string
  // חלק-היום הספציפי שממנו מסמנים את ההיעדרות (בוקר/צהריים) — כדי שסימון "לא הגיעה" בצהריים
  // לא יפנה גם את השיבוץ שלה בבוקר של אותו יום.
  dayPart: DayPart
  reportedBy: string | null
}

// כפתור "לא הגיעה היום" (3.6-א): פותחת חור זמני לחלק-היום שנלחץ בלבד, בלי לגעת בשיבוץ הקבוע.
export function useMarkAbsence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: MarkAbsenceInput) => {
      const { error } = await supabase.from('daily_absences').insert({
        school_id: input.schoolId,
        employee_id: input.employeeId,
        absence_date: input.date,
        day_part: input.dayPart,
        reported_by: input.reportedBy,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateDashboard(queryClient),
  })
}

interface SetSlotUrgencyInput {
  schoolId: number
  slotId: number
  date: string
  urgency: 'critical' | 'normal' | 'not_required'
}

// דחיפות חד-פעמית לחור בתאריך קונקרטי, מהדשבורד — לא נוגעת בקריטיות הקבועה של המשבצת בתבנית
export function useSetSlotUrgency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SetSlotUrgencyInput) => {
      const { error } = await supabase
        .from('daily_slot_urgency')
        .upsert(
          { school_id: input.schoolId, slot_id: input.slotId, assignment_date: input.date, urgency: input.urgency },
          { onConflict: 'school_id,slot_id,assignment_date' },
        )
      if (error) throw error
    },
    onSuccess: () => invalidateDashboard(queryClient),
  })
}
