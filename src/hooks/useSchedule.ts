import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type {
  Criticality,
  ScheduleTemplateRow,
  TemplateMode,
  TemplateSlotWithEmployee,
} from '../types/schedule'

// שולף את התבנית ה"active" היחידה עבור כיתה+מצב (אוכף גם ב-DB ע"י unique index)
export function useActiveTemplate(classId: number | undefined, mode: TemplateMode) {
  return useQuery({
    queryKey: ['active-template', classId, mode],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_templates')
        .select('*')
        .eq('class_id', classId!)
        .eq('mode', mode)
        .eq('status', 'active')
        .maybeSingle()
      if (error) throw error
      return data as ScheduleTemplateRow | null
    },
  })
}

export function useTemplateSlots(templateId: number | undefined) {
  return useQuery({
    queryKey: ['template-slots', templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('template_slots')
        .select('*, employee:employees(id, full_name)')
        .eq('template_id', templateId!)
        .order('weekday', { ascending: true })
      if (error) throw error
      return data as unknown as TemplateSlotWithEmployee[]
    },
  })
}

interface UpdateSlotInput {
  slotId: number
  templateId: number
  assigned_employee_id: number | null
  criticality?: Criticality
  notes?: string | null
}

// עדכון חור בודד: שיבוץ עובדת קבועה / סימון כ"חור ריק" (null) / שינוי קריטיות.
// TODO: כתיבה ל-audit_log (entity_type='template_slot') צריכה קרות בצד שרת
// (Supabase trigger/edge function) כדי לתעד גם את changed_by מה-Auth session.
export function useUpdateSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateSlotInput) => {
      const patch: Record<string, unknown> = {
        assigned_employee_id: input.assigned_employee_id,
      }
      if (input.criticality) patch.criticality = input.criticality
      if (input.notes !== undefined) patch.notes = input.notes

      const { error } = await supabase.from('template_slots').update(patch).eq('id', input.slotId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template-slots', variables.templateId] })
    },
  })
}
