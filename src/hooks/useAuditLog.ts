import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { addDays, parseISODate, toISODate } from '../lib/dateUtils'
import type { AuditLogWithUser } from '../types/audit'

// יומן השינויים (3.10/5.2 בהרחבה) — נכון להיום כותבים אליו רק שני הטריגרים על
// daily_assignments/daily_absences (ראו מיגרציית log_audit_event), כלומר הטווח הוא בדיוק
// הפעולות שקורות מהדשבורד ומסך הקייטנה (שני המסכים משתמשים באותן טבלאות/hooks בדיוק).
// "מהיום והלאה" בלבד — לא ניתן לשחזר שינויים שקרו לפני שהטריגרים הופעלו.
export function useAuditLog(schoolId: number | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['audit-log', schoolId, date],
    enabled: !!schoolId && !!date,
    queryFn: async (): Promise<AuditLogWithUser[]> => {
      const dayStart = date!
      const dayEnd = toISODate(addDays(parseISODate(date!), 1))

      const { data, error } = await supabase
        .from('audit_log')
        .select('*, changed_by_profile:profiles(full_name)')
        .eq('school_id', schoolId!)
        .in('entity_type', ['daily_assignments', 'daily_absences'])
        .gte('changed_at', dayStart)
        .lt('changed_at', dayEnd)
        .order('changed_at', { ascending: false })
      if (error) throw error
      return data as unknown as AuditLogWithUser[]
    },
  })
}
