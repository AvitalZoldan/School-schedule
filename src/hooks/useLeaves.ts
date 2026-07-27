import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { addDays, parseISODate, toISODate } from '../lib/dateUtils'
import type { EmployeeLeaveRow, LeaveDayAssignmentRow } from '../types/dashboard'

export interface LeaveWithEmployee extends EmployeeLeaveRow {
  employee: { id: number; full_name: string } | null
  leave_day_assignments: LeaveDayAssignmentRow[]
}

// כלל החופשות של בית הספר (היסטוריה מלאה — עבר/הווה/עתיד/בוטלו), למסך "חופשות" (3.7) ולכפתור
// "הוספת/ניהול חופשה" במסך עובדות. שולף גם את שיוכי המ"מ מראש לתצוגת ספירה.
export function useLeaves(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['leaves', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_leaves')
        .select('*, employee:employees(id, full_name), leave_day_assignments(*)')
        .eq('school_id', schoolId!)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data as unknown as LeaveWithEmployee[]
    },
  })
}

function invalidateLeaves(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['leaves'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

export interface LeaveFormInput {
  employeeId: number
  startDate: string
  endDate: string
  reminderDaysBefore: number
  notes: string | null
}

export interface LeaveDayAssignmentInput {
  assignmentDate: string
  slotId: number
  employeeId: number
}

interface CreateLeaveInput {
  schoolId: number
  input: LeaveFormInput
  dayAssignments: LeaveDayAssignmentInput[]
}

// יוצרת חופשה חדשה + שיוכי מ"מ מראש לימים שנבחרו (אופציונלי, סעיף 3.7)
export function useCreateLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, input, dayAssignments }: CreateLeaveInput) => {
      const { data: leave, error } = await supabase
        .from('employee_leaves')
        .insert({
          school_id: schoolId,
          employee_id: input.employeeId,
          start_date: input.startDate,
          end_date: input.endDate,
          reminder_days_before: input.reminderDaysBefore,
          notes: input.notes,
        })
        .select()
        .single()
      if (error) throw error

      if (dayAssignments.length > 0) {
        const { error: dayError } = await supabase.from('leave_day_assignments').insert(
          dayAssignments.map((d) => ({
            school_id: schoolId,
            leave_id: leave.id,
            assignment_date: d.assignmentDate,
            slot_id: d.slotId,
            employee_id: d.employeeId,
          })),
        )
        if (dayError) throw dayError
      }
      return leave as EmployeeLeaveRow
    },
    onSuccess: () => invalidateLeaves(queryClient),
  })
}

interface UpdateLeaveInput {
  schoolId: number
  leaveId: number
  input: LeaveFormInput
  dayAssignments: LeaveDayAssignmentInput[]
}

// עריכת חופשה קיימת: מעדכנת את פרטי החופשה ומסנכרנת מחדש את כל שיוכי המ"מ מראש (מוחקת את
// הקיימים ומכניסה את הרשימה העדכנית) — פשוט וודאי יותר מהשוואת דלתא, וכמות השורות זניחה.
// שינוי טווח מאפס את reminder_dismissed כדי שתזכורת רלוונטית תיבחן מחדש מול התאריך החדש.
export function useUpdateLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, leaveId, input, dayAssignments }: UpdateLeaveInput) => {
      const { error } = await supabase
        .from('employee_leaves')
        .update({
          start_date: input.startDate,
          end_date: input.endDate,
          reminder_days_before: input.reminderDaysBefore,
          notes: input.notes,
          reminder_dismissed: false,
        })
        .eq('id', leaveId)
        .eq('school_id', schoolId)
      if (error) throw error

      const { error: delError } = await supabase
        .from('leave_day_assignments')
        .delete()
        .eq('leave_id', leaveId)
        .eq('school_id', schoolId)
      if (delError) throw delError

      if (dayAssignments.length > 0) {
        const { error: insError } = await supabase.from('leave_day_assignments').insert(
          dayAssignments.map((d) => ({
            school_id: schoolId,
            leave_id: leaveId,
            assignment_date: d.assignmentDate,
            slot_id: d.slotId,
            employee_id: d.employeeId,
          })),
        )
        if (insError) throw insError
      }
    },
    onSuccess: () => invalidateLeaves(queryClient),
  })
}

// ביטול חופשה (3.7): לא מוחקת את הרשומה עצמה (ההיסטוריה נשמרת), אבל מוחקת את שיוכי המ"מ
// מראש — כפי שהוצג באזהרת האישור לפני הביטול.
export function useCancelLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, leaveId }: { schoolId: number; leaveId: number }) => {
      const { error: dayError } = await supabase
        .from('leave_day_assignments')
        .delete()
        .eq('leave_id', leaveId)
        .eq('school_id', schoolId)
      if (dayError) throw dayError

      const { error } = await supabase
        .from('employee_leaves')
        .update({ status: 'cancelled' })
        .eq('id', leaveId)
        .eq('school_id', schoolId)
      if (error) throw error
    },
    onSuccess: () => invalidateLeaves(queryClient),
  })
}

// סגירת באנר התזכורת בדשבורד — לא מופיע שוב לאחר מכן (עד שהטווח ישתנה בעריכה)
export function useDismissLeaveReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, leaveId }: { schoolId: number; leaveId: number }) => {
      const { error } = await supabase
        .from('employee_leaves')
        .update({ reminder_dismissed: true })
        .eq('id', leaveId)
        .eq('school_id', schoolId)
      if (error) throw error
    },
    onSuccess: () => invalidateLeaves(queryClient),
  })
}

// חופשות פעילות שהגיע תאריך "X ימים לפני החזרה" שלהן וטרם נסגרו ע"י המשתמשת — לבאנר בדשבורד (3.7)
export function useLeaveReminders(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['leave-reminders', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_leaves')
        .select('*, employee:employees(id, full_name)')
        .eq('school_id', schoolId!)
        .eq('status', 'active')
        .eq('reminder_dismissed', false)
      if (error) throw error

      const today = toISODate(new Date())
      return (data as unknown as LeaveWithEmployee[]).filter((leave) => {
        if (leave.end_date < today) return false
        const reminderDate = toISODate(addDays(parseISODate(leave.end_date), -leave.reminder_days_before))
        return reminderDate <= today
      })
    },
  })
}
