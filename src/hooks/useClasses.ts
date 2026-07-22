import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ClassRow } from '../types/schedule'

export function useClasses(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['classes', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('name', { ascending: true })
      if (error) throw error
      return data as ClassRow[]
    },
  })
}

// כיתה + נתוני שיבוץ בסיסי, למסך "כיתות" (5.1 במוקאפ): חורים מוגדרים, חורים ריקים, סטטוס.
// כולל כיתות לא-פעילות (active=false) — הן מעומעמות/מוסתרות בתצוגה, לא נמחקות מהשאילתה,
// כדי לאפשר "שחזור" בהתאם ללוגיקה של עובדות (סעיף 3.8).
export interface ClassOverviewRow extends ClassRow {
  totalSlots: number
  emptySlots: number
  status: 'not_defined' | 'partial' | 'complete'
}

export function useClassesOverview(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['classes-overview', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select(
          `*,
          schedule_templates (
            id, mode, status,
            template_slots ( id, assigned_employee_id, criticality )
          )`,
        )
        .eq('school_id', schoolId!)
        .order('name', { ascending: true })

      if (error) throw error

      return (data ?? []).map((row: any): ClassOverviewRow => {
        const activeTemplate = (row.schedule_templates ?? []).find(
          (t: any) => t.mode === 'regular' && t.status === 'active',
        )
        const slots = activeTemplate?.template_slots ?? []
        const totalSlots = slots.length
        const emptySlots = slots.filter(
          (s: any) => !s.assigned_employee_id && s.criticality !== 'not_required',
        ).length

        const status: ClassOverviewRow['status'] =
          totalSlots === 0 ? 'not_defined' : emptySlots === 0 ? 'complete' : 'partial'

        const { schedule_templates: _omit, ...classFields } = row
        return { ...classFields, totalSlots, emptySlots, status }
      })
    },
  })
}

interface CreateClassInput {
  schoolId: number
  name: string
}

// יוצרת כיתה חדשה + תבנית שיבוץ בסיסית פעילה + 36 חורי ברירת מחדל
// (מורה + 2 סייעות × בוקר/צהריים × 6 ימי שבוע) — הכל בפעולת DB אחת אטומית (ראו migration).
export function useCreateClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, name }: CreateClassInput) => {
      const { data, error } = await supabase.rpc('create_class_with_default_schedule', {
        p_school_id: schoolId,
        p_class_name: name,
      })
      if (error) throw error
      return data as number // מזהה הכיתה החדשה
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classes', variables.schoolId] })
      queryClient.invalidateQueries({ queryKey: ['classes-overview', variables.schoolId] })
    },
  })
}

interface UpdateClassInput {
  classId: number
  schoolId: number
  name?: string
  active?: boolean
}

// עריכת שם כיתה ו/או השבתה-שחזור (active). לא מוחקת בפועל — תואם ללוגיקת עובדות (3.8):
// כיתה לא-פעילה מוסרת מרשימות הבחירה (למשל ב"שיבוץ בסיסי"), אך היסטוריית השיבוצים נשמרת.
export function useUpdateClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ classId, name, active }: UpdateClassInput) => {
      const patch: Record<string, unknown> = {}
      if (name !== undefined) patch.name = name
      if (active !== undefined) patch.active = active

      const { error } = await supabase.from('classes').update(patch).eq('id', classId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classes', variables.schoolId] })
      queryClient.invalidateQueries({ queryKey: ['classes-overview', variables.schoolId] })
    },
  })
}
