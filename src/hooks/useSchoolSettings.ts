import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DateDisplayMode } from '../lib/dateUtils'

export type DashboardDefaultRange = 'day' | 'week'

export interface SchoolSettingsRow {
  school_id: number
  dashboard_default_range: DashboardDefaultRange
  date_display: DateDisplayMode
  updated_at: string
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
  patch: Partial<Pick<SchoolSettingsRow, 'dashboard_default_range' | 'date_display'>>
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
