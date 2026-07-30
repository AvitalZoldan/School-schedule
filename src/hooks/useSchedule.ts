import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type {
  Criticality,
  ScheduleTemplateRow,
  TemplateMode,
  TemplateSlotWithEmployee,
  TemplateStatus,
} from '../types/schedule'

export interface SlotForConflictCheck {
  id: number
  template_id: number
  class_id: number
  weekday: number
  day_part: 'morning' | 'afternoon'
  role: string
  assigned_employee_id: number | null
}

// כל החורים המשובצים לעובדת קבועה בבית הספר הנוכחי (school_id שהועבר) — בכל הכיתות שלו,
// עבור תבניות מאותו mode+status — לבדיקת כפילות שיבוץ (אותה עובדת, אותו weekday+day_part,
// בין אם בכיתה אחרת ובין אם בתפקיד אחר באותה כיתה) לפני שמירת שיבוץ חדש ב-SlotCell.
// נשלף בנפרד מ-useTemplateSlots כי המסך (BaseSchedule/Draft) מציג כיתה אחת בכל פעם, אבל
// הכפילות רלוונטית על פני כל הכיתות של אותו בית ספר (לא בתי ספר אחרים).
export function useSchoolSlotsForConflictCheck(
  schoolId: number | undefined,
  mode: TemplateMode,
  status: TemplateStatus,
) {
  return useQuery({
    queryKey: ['school-slots-conflict-check', schoolId, mode, status],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data: templates, error: templatesError } = await supabase
        .from('schedule_templates')
        .select('id, class_id')
        .eq('school_id', schoolId!)
        .eq('mode', mode)
        .eq('status', status)
      if (templatesError) throw templatesError

      const templateIds = (templates ?? []).map((t) => t.id)
      if (templateIds.length === 0) return [] as SlotForConflictCheck[]

      const { data: slots, error: slotsError } = await supabase
        .from('template_slots')
        .select('id, template_id, weekday, day_part, role, assigned_employee_id')
        .in('template_id', templateIds)
        .not('assigned_employee_id', 'is', null)
      if (slotsError) throw slotsError

      const classIdByTemplateId = new Map((templates ?? []).map((t) => [t.id, t.class_id]))
      return (slots ?? []).map((s) => ({
        id: s.id,
        template_id: s.template_id,
        class_id: classIdByTemplateId.get(s.template_id)!,
        weekday: s.weekday,
        day_part: s.day_part,
        role: s.role,
        assigned_employee_id: s.assigned_employee_id,
      })) as SlotForConflictCheck[]
    },
  })
}

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

// מזהה חורים כפולים (אותו weekday+day_part+role) בתבנית — הם בלתי-נראים במסך "שיבוץ בסיסי"
// (WeekGrid מציג שורה אחת לכל צירוף role+day_part, כלומר .find() תמיד "בולע" את הכפילות),
// אבל גורמים לחוסר-התאמה מול הדאשבורד/שיבוץ מ"מ: לשתי השאילתות הנפרדות (useTemplateSlots
// מול useDashboardData) אין סדר שורות מובטח בלי כפילות ייחודית, ולכן ה-.find() שלהן עלול
// "לבחור" עותק שונה של אותו חור ולהראות סטטוס שונה בכל מסך
export function findDuplicateSlotGroups(slots: TemplateSlotWithEmployee[]) {
  const byKey = new Map<string, TemplateSlotWithEmployee[]>()
  for (const slot of slots) {
    const key = `${slot.weekday}:${slot.day_part}:${slot.role}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(slot)
  }
  return [...byKey.values()].filter((group) => group.length > 1)
}

// מנקה כפילויות: בכל קבוצה כפולה משאירה עותק אחד (מועדף: המשובץ לעובדת קבועה, אחרת המזהה
// הנמוך ביותר) ומוחקת את השאר — כולל daily_assignments שמפנים אליהם, כדי לא להיתקע ב-FK
export function useCleanupDuplicateSlots() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId, slots }: { templateId: number; slots: TemplateSlotWithEmployee[] }) => {
      const groups = findDuplicateSlotGroups(slots)
      const idsToDelete: number[] = []
      for (const group of groups) {
        const sorted = [...group].sort((a, b) => {
          const aFilled = a.assigned_employee_id ? 0 : 1
          const bFilled = b.assigned_employee_id ? 0 : 1
          return aFilled - bFilled || a.id - b.id
        })
        idsToDelete.push(...sorted.slice(1).map((s) => s.id))
      }
      if (idsToDelete.length === 0) return 0

      const { error: assignmentsError } = await supabase
        .from('daily_assignments')
        .delete()
        .in('slot_id', idsToDelete)
      if (assignmentsError) throw assignmentsError

      const { error: slotsError } = await supabase.from('template_slots').delete().in('id', idsToDelete)
      if (slotsError) throw slotsError

      return idsToDelete.length
    },
    onSuccess: (_count, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template-slots', variables.templateId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['school-slots-conflict-check'] })
    },
  })
}

// שחזור חורי ברירת מחדל לתבנית קיימת שהתרוקנה מ-slots (למשל תקלה) — אותו מבנה בדיוק כמו
// ב-create_class_with_default_schedule (RPC של יצירת כיתה חדשה): מורה (קריטי) + 2 סייעות
// (רגיל) × בוקר/צהריים × 6 ימי שבוע = 36 חורים, כולם ללא שיבוץ עובדת קבועה
const DEFAULT_ROLES: { role: string; criticality: Criticality }[] = [
  { role: 'מורה', criticality: 'critical' },
  { role: 'סייעת 1', criticality: 'normal' },
  { role: 'סייעת 2', criticality: 'normal' },
]

export function useSeedDefaultSlots() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId }: { templateId: number }) => {
      const rows = []
      for (let weekday = 1; weekday <= 6; weekday++) {
        for (const dayPart of ['morning', 'afternoon'] as const) {
          for (const { role, criticality } of DEFAULT_ROLES) {
            rows.push({
              template_id: templateId,
              weekday,
              day_part: dayPart,
              role,
              slot_type: 'fixed',
              criticality,
              assigned_employee_id: null,
            })
          }
        }
      }
      const { error } = await supabase.from('template_slots').insert(rows)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template-slots', variables.templateId] })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['school-slots-conflict-check'] })
    },
  })
}

// התבנית ה"draft" היחידה (אם קיימת) עבור כיתה+מצב — לכל כיתה מותרת טיוטה אחת בו-זמנית בלבד
export function useDraftTemplate(classId: number | undefined, mode: TemplateMode) {
  return useQuery({
    queryKey: ['draft-template', classId, mode],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_templates')
        .select('*')
        .eq('class_id', classId!)
        .eq('mode', mode)
        .eq('status', 'draft')
        .maybeSingle()
      if (error) throw error
      return data as ScheduleTemplateRow | null
    },
  })
}

interface CreateDraftInput {
  schoolId: number
  classId: number
  mode: TemplateMode
  sourceTemplateId: number | null
}

function invalidateScheduleQueries(queryClient: ReturnType<typeof useQueryClient>, classId: number, mode: TemplateMode) {
  queryClient.invalidateQueries({ queryKey: ['draft-template', classId, mode] })
  queryClient.invalidateQueries({ queryKey: ['active-template', classId, mode] })
  queryClient.invalidateQueries({ queryKey: ['classes'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  queryClient.invalidateQueries({ queryKey: ['school-slots-conflict-check'] })
}

// יוצרת טיוטה חדשה לכיתה: מעתיקה את כל החורים מהתבנית הפעילה (אם קיימת) לתבנית חדשה
// במצב draft, כדי שהעריכה תהיה חופשית בלי להשפיע על השיבוץ הפעיל (5.5 באפיון)
export function useCreateDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateDraftInput) => {
      const { data: draft, error: insertError } = await supabase
        .from('schedule_templates')
        .insert({
          school_id: input.schoolId,
          class_id: input.classId,
          mode: input.mode,
          status: 'draft',
          based_on_template_id: input.sourceTemplateId,
        })
        .select()
        .single()
      if (insertError) throw insertError

      if (input.sourceTemplateId) {
        const { data: sourceSlots, error: slotsError } = await supabase
          .from('template_slots')
          .select('*')
          .eq('template_id', input.sourceTemplateId)
        if (slotsError) throw slotsError

        if (sourceSlots && sourceSlots.length > 0) {
          const { error: copyError } = await supabase.from('template_slots').insert(
            sourceSlots.map((s) => ({
              template_id: draft.id,
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

      return draft as ScheduleTemplateRow
    },
    onSuccess: (_data, variables) => {
      invalidateScheduleQueries(queryClient, variables.classId, variables.mode)
    },
  })
}

interface DiscardDraftInput {
  draftTemplateId: number
  classId: number
  mode: TemplateMode
}

// זורקת טיוטה בלי להשפיע על התבנית הפעילה
export function useDiscardDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: DiscardDraftInput) => {
      const { error: slotsError } = await supabase
        .from('template_slots')
        .delete()
        .eq('template_id', input.draftTemplateId)
      if (slotsError) throw slotsError

      const { error: templateError } = await supabase
        .from('schedule_templates')
        .delete()
        .eq('id', input.draftTemplateId)
      if (templateError) throw templateError
    },
    onSuccess: (_data, variables) => {
      invalidateScheduleQueries(queryClient, variables.classId, variables.mode)
    },
  })
}

interface ApplyDraftInput {
  draftTemplateId: number
  previousActiveTemplateId: number | null
  classId: number
  mode: TemplateMode
}

// "החלת טיוטה" (5.5 באפיון): מוחקת לגמרי את התבנית הפעילה הקודמת ומעלה את הטיוטה
// למצב active — מחליפה מיידית, בלי לשמור גרסה קודמת
export function useApplyDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ApplyDraftInput) => {
      if (input.previousActiveTemplateId) {
        // הטיוטה עצמה מצביעה על התבנית הישנה דרך based_on_template_id — יש לנתק את ההפניה
        // קודם, אחרת מחיקת schedule_templates תיכשל על מגבלת FK (וה-slots כבר יימחקו בפועל,
        // כי הקריאות הן נפרדות ולא בטרנזקציה אחת — בדיוק המצב שגרם לתבנית ריקה בעבר)
        const { error: unlinkError } = await supabase
          .from('schedule_templates')
          .update({ based_on_template_id: null })
          .eq('id', input.draftTemplateId)
        if (unlinkError) throw unlinkError

        // מ"מ שכבר שובצו אי-פעם לחורים של התבנית הישנה (daily_assignments) מפנים אליהם
        // לפי slot_id — יש למחוק אותם קודם, אחרת מחיקת template_slots תיכשל על מגבלת FK
        const { data: oldSlots, error: oldSlotsError } = await supabase
          .from('template_slots')
          .select('id')
          .eq('template_id', input.previousActiveTemplateId)
        if (oldSlotsError) throw oldSlotsError

        const oldSlotIds = (oldSlots ?? []).map((s) => s.id)
        if (oldSlotIds.length > 0) {
          const { error: assignmentsError } = await supabase
            .from('daily_assignments')
            .delete()
            .in('slot_id', oldSlotIds)
          if (assignmentsError) throw assignmentsError
        }

        const { error: slotsError } = await supabase
          .from('template_slots')
          .delete()
          .eq('template_id', input.previousActiveTemplateId)
        if (slotsError) throw slotsError

        const { error: templateError } = await supabase
          .from('schedule_templates')
          .delete()
          .eq('id', input.previousActiveTemplateId)
        if (templateError) throw templateError
      }

      const { error: activateError } = await supabase
        .from('schedule_templates')
        .update({ status: 'active', applied_at: new Date().toISOString() })
        .eq('id', input.draftTemplateId)
      if (activateError) throw activateError
    },
    onSuccess: (_data, variables) => {
      invalidateScheduleQueries(queryClient, variables.classId, variables.mode)
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
      // הדאשבורד/שיבוץ מ"מ/דוח לעובדת שולפים slots דרך useDashboardData בנפרד — בלי זה הם
      // ממשיכים להראות מטמון ישן של השיבוץ הבסיסי עד שפעולה אחרת (למשל שיבוץ מ"מ) מרעננת אותם
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      // בלי זה, בדיקת הכפילות (SlotCell) ממשיכה להראות שיבוץ ישן (תפקיד/כיתה) אחרי שהוא שונה —
      // בדיוק המקרה שגרם להודעת "היא כבר משובצת כמורה" למרות שכבר הוחלפה לסייעת
      queryClient.invalidateQueries({ queryKey: ['school-slots-conflict-check'] })
    },
  })
}
