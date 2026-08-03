import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DayPart } from '../types/schedule'

// משך (בשעות) בין שתי שעות בפורמט "HH:MM" או "HH:MM:SS" — null אם אחת מהן לא הוגדרה
function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  return Math.max(0, endH * 60 + endM - (startH * 60 + startM)) / 60
}

// סך שעות השיבוץ השבועי של כל עובדת, לפי התבנית הבסיסית הפעילה כרגע (mode='regular',
// status='active') × שעות חלק-היום המוגדרות לבית הספר (מסך "ניהול" > "שעות היום").
// שדה מחושב לתצוגה בלבד — לא נשמר ב-DB.
export function useEmployeeScheduledHours(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['employee-scheduled-hours', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [settingsRes, activeClassesRes, templatesRes] = await Promise.all([
        supabase
          .from('school_settings')
          .select('morning_start, morning_end, afternoon_start, afternoon_end')
          .eq('school_id', schoolId!)
          .single(),
        supabase.from('classes').select('id').eq('school_id', schoolId!).eq('active', true),
        supabase
          .from('schedule_templates')
          .select('id, class_id')
          .eq('school_id', schoolId!)
          .eq('mode', 'regular')
          .eq('status', 'active'),
      ])
      if (settingsRes.error) throw settingsRes.error
      if (activeClassesRes.error) throw activeClassesRes.error
      if (templatesRes.error) throw templatesRes.error

      const hoursByDayPart: Record<DayPart, number> = {
        morning: hoursBetween(settingsRes.data.morning_start, settingsRes.data.morning_end),
        afternoon: hoursBetween(settingsRes.data.afternoon_start, settingsRes.data.afternoon_end),
      }

      const activeClassIds = new Set((activeClassesRes.data ?? []).map((c) => c.id))
      const templateIds = (templatesRes.data ?? [])
        .filter((t) => activeClassIds.has(t.class_id))
        .map((t) => t.id)
      const hoursByEmployeeId = new Map<number, number>()
      if (templateIds.length === 0) return hoursByEmployeeId

      const { data: slots, error: slotsError } = await supabase
        .from('template_slots')
        .select('weekday, day_part, assigned_employee_id')
        .in('template_id', templateIds)
        .not('assigned_employee_id', 'is', null)
      if (slotsError) throw slotsError

      // עובדת יכולה להופיע ביותר מחור אחד באותו weekday+day_part (למשל משובצת בטעות/במכוון
      // בשני תפקידים/כיתות בו-זמנית) — פיזית מדובר במשמרת אחת, ולכן סופרים כל צירוף
      // עובדת+יום+חלק-יום פעם אחת בלבד, לא לפי מספר החורים הגולמי
      const uniqueSessions = new Set<string>()
      for (const slot of slots as { weekday: number; day_part: DayPart; assigned_employee_id: number }[]) {
        uniqueSessions.add(`${slot.assigned_employee_id}-${slot.weekday}-${slot.day_part}`)
      }
      for (const key of uniqueSessions) {
        const [employeeId, , dayPart] = key.split('-')
        const current = hoursByEmployeeId.get(Number(employeeId)) ?? 0
        hoursByEmployeeId.set(Number(employeeId), current + hoursByDayPart[dayPart as DayPart])
      }
      return hoursByEmployeeId
    },
  })
}
