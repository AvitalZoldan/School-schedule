import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface HolidayRow {
  id: number
  school_id: number
  holiday_date: string
  label: string | null
  created_at: string
}

// ימי חופש/חג ברמת בית-ספר בטווח תאריכים נתון — ראו migration school_holidays
export function useHolidays(schoolId: number | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['holidays', schoolId, startDate, endDate],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_holidays')
        .select('*')
        .eq('school_id', schoolId!)
        .gte('holiday_date', startDate)
        .lte('holiday_date', endDate)
      if (error) throw error
      return data as HolidayRow[]
    },
  })
}

// כל ימי החופש של בית הספר (בלי הגבלת טווח) — למסך "ניהול", לרשימה/הוספה/מחיקה
export function useSchoolHolidays(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['holidays', 'all', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_holidays')
        .select('*')
        .eq('school_id', schoolId!)
        .order('holiday_date', { ascending: true })
      if (error) throw error
      return data as HolidayRow[]
    },
  })
}

export function useSetHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      schoolId,
      date,
      label,
    }: {
      schoolId: number
      date: string
      label?: string | null
    }) => {
      const { error } = await supabase
        .from('school_holidays')
        .upsert(
          { school_id: schoolId, holiday_date: date, label: label ?? null },
          { onConflict: 'school_id,holiday_date' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] })
    },
  })
}

export function useRemoveHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, date }: { schoolId: number; date: string }) => {
      const { error } = await supabase
        .from('school_holidays')
        .delete()
        .eq('school_id', schoolId)
        .eq('holiday_date', date)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] })
    },
  })
}
