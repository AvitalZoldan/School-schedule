import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface SystemSettingsRow {
  id: number
  idle_timeout_minutes: number
}

// הגדרות גלובליות למערכת (שורה יחידה) — נגישות לקריאה לכל משתמשת פעילה (כדי להחיל את זמן
// הניתוק האוטומטי בכל מקום), אך נערכות רק ע"י מנהל/ת מערכת ראשי/ת (RLS update_system_admin)
export function useSystemSettings() {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single()
      if (error) throw error
      return data as SystemSettingsRow
    },
  })
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ idleTimeoutMinutes }: { idleTimeoutMinutes: number }) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ idle_timeout_minutes: idleTimeoutMinutes })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-settings'] }),
  })
}
