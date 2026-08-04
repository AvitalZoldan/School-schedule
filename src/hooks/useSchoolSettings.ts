import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DateDisplayMode } from '../lib/dateUtils'

export type DashboardDefaultRange = 'day' | 'week'

export interface SchoolSettingsRow {
  school_id: number
  dashboard_default_range: DashboardDefaultRange
  date_display: DateDisplayMode
  updated_at: string
  morning_label: string
  morning_start: string | null
  morning_end: string | null
  afternoon_label: string
  afternoon_start: string | null
  afternoon_end: string | null
}

// פרמטרים ברמת בית-ספר, נערכים במסך "ניהול" — כרגע: תצוגת ברירת מחדל בדאשבורד (יום/שבוע).
// שורה אחת קיימת מראש לכל בית ספר (ראו migration), כך שהשליפה תמיד מוצאת תוצאה.
export function useSchoolSettings(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['school-settings', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .eq('school_id', schoolId!)
        .single()
      if (error) throw error
      return data as SchoolSettingsRow
    },
  })
}

interface UpdateSchoolSettingsInput {
  schoolId: number
  patch: Partial<
    Pick<
      SchoolSettingsRow,
      | 'dashboard_default_range'
      | 'date_display'
      | 'morning_label'
      | 'morning_start'
      | 'morning_end'
      | 'afternoon_label'
      | 'afternoon_start'
      | 'afternoon_end'
    >
  >
}

export function useUpdateSchoolSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, patch }: UpdateSchoolSettingsInput) => {
      const { error } = await supabase.from('school_settings').update(patch).eq('school_id', schoolId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['school-settings', variables.schoolId] })
    },
  })
}

// "התחלת שנה חדשה" (מסך ניהול): מארכבת בטרנזקציה אחת בצד השרת (RPC start_new_year) את כל
// נתוני השנה החולפת של בית הספר — תבניות שיבוץ, חופשות, קייטנות, ימי חופש, שיבוצים/היעדרויות
// יומיים, ואת ההיסטוריה. זה סימון archived_at ולא DELETE: הנתונים נשארים ב-DB (נגישים רק דרך
// גישה ישירה למסד הנתונים) אבל נעלמים מהאפליקציה דרך מדיניות ה-RLS. עובדות, כיתות ותשתית
// (תפקידים/קטגוריות/הגדרות) לא נפגעות. הרשאה ובדיקת school_id נאכפות בתוך הפונקציה עצמה
// (SECURITY DEFINER).
export function useStartNewYear() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (schoolId: number) => {
      const { error } = await supabase.rpc('start_new_year', { p_school_id: schoolId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}
