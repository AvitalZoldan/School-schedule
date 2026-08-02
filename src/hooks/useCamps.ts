import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { CampPeriodRow, CampRow, CampWithPeriods } from '../types/camps'
import type { ClassRow, TemplateSlotWithEmployee } from '../types/schedule'
import type { DailyAbsenceRow, DailyAssignmentRow, EmployeeLeaveRow } from '../types/dashboard'
import type { DashboardClassData, DashboardData } from './useDashboard'

// כל הקייטנות שהוגדרו אי-פעם בבית הספר (עבר/הווה/עתיד) — נשמרות להיסטוריה לצמיתות (3.10),
// לא ניתנות למחיקה, רק לעריכה (שם/טווחים)
export function useCamps(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['camps', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('camps')
        .select('*, camp_periods(*)')
        .eq('school_id', schoolId!)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data as unknown as CampWithPeriods[]
    },
  })
}

export function useCamp(campId: number | undefined) {
  return useQuery({
    queryKey: ['camp', campId],
    enabled: !!campId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('camps')
        .select('*, camp_periods(*)')
        .eq('id', campId!)
        .single()
      if (error) throw error
      return data as unknown as CampWithPeriods
    },
  })
}

function invalidateCamps(queryClient: ReturnType<typeof useQueryClient>, campId?: number) {
  queryClient.invalidateQueries({ queryKey: ['camps'] })
  if (campId) queryClient.invalidateQueries({ queryKey: ['camp', campId] })
}

export interface CampPeriodInput {
  startDate: string
  endDate: string
  includesMorning: boolean
  includesAfternoon: boolean
}

function aggregateRange(periods: CampPeriodInput[]): { startDate: string; endDate: string } {
  const starts = periods.map((p) => p.startDate).sort()
  const ends = periods.map((p) => p.endDate).sort()
  return { startDate: starts[0], endDate: ends[ends.length - 1] }
}

interface CreateCampInput {
  schoolId: number
  name: string
  periods: CampPeriodInput[]
}

// יוצרת קייטנה חדשה: שורת camps + camp_periods, ולכל כיתה פעילה — תבנית שיבוץ עצמאית
// (mode='camp', camp_id) כהעתק מלא של התבנית הרגילה הפעילה שלה (3.10: "נוצר כהעתק של השיבוץ
// הבסיסי הרגיל בעת הקמת הקיטנה"), ומשם עורכים אותה בנפרד לגמרי מהשנה הרגילה.
export function useCreateCamp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, name, periods }: CreateCampInput) => {
      const { startDate, endDate } = aggregateRange(periods)

      const { data: camp, error: campError } = await supabase
        .from('camps')
        .insert({ school_id: schoolId, name, start_date: startDate, end_date: endDate })
        .select()
        .single()
      if (campError) throw campError

      const { error: periodsError } = await supabase.from('camp_periods').insert(
        periods.map((p) => ({
          school_id: schoolId,
          camp_id: camp.id,
          start_date: p.startDate,
          end_date: p.endDate,
          includes_morning: p.includesMorning,
          includes_afternoon: p.includesAfternoon,
        })),
      )
      if (periodsError) throw periodsError

      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', schoolId)
        .eq('active', true)
      if (classesError) throw classesError

      for (const cls of (classes ?? []) as Pick<ClassRow, 'id'>[]) {
        const { data: sourceTemplate, error: sourceError } = await supabase
          .from('schedule_templates')
          .select('id')
          .eq('class_id', cls.id)
          .eq('mode', 'regular')
          .eq('status', 'active')
          .maybeSingle()
        if (sourceError) throw sourceError

        const { data: campTemplate, error: campTemplateError } = await supabase
          .from('schedule_templates')
          .insert({
            school_id: schoolId,
            class_id: cls.id,
            mode: 'camp',
            status: 'active',
            camp_id: camp.id,
            based_on_template_id: sourceTemplate?.id ?? null,
            applied_at: new Date().toISOString(),
          })
          .select()
          .single()
        if (campTemplateError) throw campTemplateError

        if (sourceTemplate) {
          const { data: sourceSlots, error: slotsError } = await supabase
            .from('template_slots')
            .select('*')
            .eq('template_id', sourceTemplate.id)
          if (slotsError) throw slotsError

          if (sourceSlots && sourceSlots.length > 0) {
            const { error: copyError } = await supabase.from('template_slots').insert(
              sourceSlots.map((s) => ({
                template_id: campTemplate.id,
                weekday: s.weekday,
                day_part: s.day_part,
                role: s.role,
                slot_type: s.slot_type,
                criticality: s.criticality,
                assigned_employee_id: s.assigned_employee_id,
                notes: s.notes,
              })),
            )
            if (copyError) throw copyError
          }
        }
      }

      return camp as CampRow
    },
    onSuccess: () => invalidateCamps(queryClient),
  })
}

interface UpdateCampInput {
  campId: number
  schoolId: number
  name: string
  periods: CampPeriodInput[]
}

// עריכת קייטנה קיימת (5.4-מקביל, 3.10): שם וטווחים ניתנים לעריכה בכל עת; אין אפשרות מחיקה.
// שינוי טווחים מסנכרן מחדש את camp_periods (מוחק את הישנים ומכניס את העדכניים) — לא נוגע
// בתבניות/שיבוצים שכבר נוצרו, כדי לא לאבד שיבוץ מ"מ שכבר בוצע בפועל.
export function useUpdateCamp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ campId, schoolId, name, periods }: UpdateCampInput) => {
      const { startDate, endDate } = aggregateRange(periods)

      const { error: campError } = await supabase
        .from('camps')
        .update({ name, start_date: startDate, end_date: endDate })
        .eq('id', campId)
        .eq('school_id', schoolId)
      if (campError) throw campError

      const { error: delError } = await supabase
        .from('camp_periods')
        .delete()
        .eq('camp_id', campId)
        .eq('school_id', schoolId)
      if (delError) throw delError

      const { error: insError } = await supabase.from('camp_periods').insert(
        periods.map((p) => ({
          school_id: schoolId,
          camp_id: campId,
          start_date: p.startDate,
          end_date: p.endDate,
          includes_morning: p.includesMorning,
          includes_afternoon: p.includesAfternoon,
        })),
      )
      if (insError) throw insError
    },
    onSuccess: (_data, variables) => invalidateCamps(queryClient, variables.campId),
  })
}

// התבנית ה"active" של כיתה בתוך קייטנה ספציפית — בניגוד ל-useActiveTemplate הרגילה (שמניחה
// תבנית פעילה יחידה לכל class+mode), כאן יכולות להיות כמה תבניות camp פעילות בו-זמנית לאותה
// כיתה (אחת לכל קייטנה, ראו אינדקס ייחודי class_id+camp_id ב-DB) — לכן חובה לסנן גם לפי camp_id
export function useActiveCampTemplate(classId: number | undefined, campId: number | undefined) {
  return useQuery({
    queryKey: ['active-camp-template', classId, campId],
    enabled: !!classId && !!campId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_templates')
        .select('*')
        .eq('class_id', classId!)
        .eq('camp_id', campId!)
        .eq('mode', 'camp')
        .eq('status', 'active')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// נתוני "דאשבורד" עבור קייטנה ספציפית — מקביל ל-useDashboardData הרגיל, אבל שולף רק תבניות
// camp ששייכות לקייטנה הזו. השנה הרגילה אינה רלוונטית בזמן קייטנה (לפי החלטת המשתמשת),
// ולכן אין צורך לשלב נתונים ממנה. חוזרת פורמט DashboardData זהה כדי לאפשר שימוש חוזר מלא
// ב-ClassGrid/DashboardSlotCell/resolveDashboard הקיימים.
export function useCampDashboardData(
  schoolId: number | undefined,
  campId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
) {
  return useQuery({
    queryKey: ['camp-dashboard', schoolId, campId, startDate, endDate],
    enabled: !!schoolId && !!campId && !!startDate && !!endDate,
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
              .eq('mode', 'camp')
              .eq('camp_id', campId!)
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

      const [assignmentsRes, absencesRes, leavesRes] = await Promise.all([
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
      ])

      if (assignmentsRes.error) throw assignmentsRes.error
      if (absencesRes.error) throw absencesRes.error
      if (leavesRes.error) throw leavesRes.error

      return {
        classes,
        dailyAssignments: (assignmentsRes.data ?? []) as DailyAssignmentRow[],
        absences: (absencesRes.data ?? []) as DailyAbsenceRow[],
        leaves: (leavesRes.data ?? []) as EmployeeLeaveRow[],
        urgencyOverrides: [],
      }
    },
  })
}

export type { CampPeriodRow }
