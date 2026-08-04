import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DayPart } from '../types/schedule'

export interface HolidayRow {
  id: number
  school_id: number
  holiday_date: string
  label: string | null
  created_at: string
  // חלק-יום שעדיין פעיל בתאריך זה ("יום קצר") — כששניהם false זהו יום חופש מלא (ברירת המחדל
  // ההיסטורית): גם בוקר וגם צהריים מבוטלים. כשאחד מהם true, רק חלק-היום השני מבוטל.
  includes_morning: boolean
  includes_afternoon: boolean
}

// האם חלק-היום הנתון מבוטל בתאריך הזה (יום חופש מלא, או יום קצר שבו דווקא החלק הזה לא פעיל)
export function holidayDisablesDayPart(holiday: HolidayRow, dayPart: DayPart): boolean {
  return dayPart === 'morning' ? !holiday.includes_morning : !holiday.includes_afternoon
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
      includesMorning = false,
      includesAfternoon = false,
    }: {
      schoolId: number
      date: string
      label?: string | null
      includesMorning?: boolean
      includesAfternoon?: boolean
    }) => {
      const { error } = await supabase
        .from('school_holidays')
        .upsert(
          {
            school_id: schoolId,
            holiday_date: date,
            label: label ?? null,
            includes_morning: includesMorning,
            includes_afternoon: includesAfternoon,
          },
          { onConflict: 'school_id,holiday_date' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] })
    },
  })
}

// הוספת כמה ימי חופש בבת אחת (ייבוא מקובץ, ראו ImportHolidaysModal) — upsert יחיד לכל
// השורות, כמו useBulkCreateEmployees
export function useBulkSetHolidays() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      schoolId,
      rows,
    }: {
      schoolId: number
      rows: { date: string; label: string | null; includesMorning: boolean; includesAfternoon: boolean }[]
    }) => {
      if (rows.length === 0) return
      const { error } = await supabase.from('school_holidays').upsert(
        rows.map((r) => ({
          school_id: schoolId,
          holiday_date: r.date,
          label: r.label,
          includes_morning: r.includesMorning,
          includes_afternoon: r.includesAfternoon,
        })),
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
