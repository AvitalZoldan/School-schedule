import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { EmployeeCategoryRow, EmployeeRow, EmployeeStatus, EmployeeTypeRow } from '../types/schedule'

const EMPLOYEE_SELECT = '*, employee_type:employee_types(id, code, label), category:employee_categories(id, name, color)'

export interface EmployeeWithType extends EmployeeRow {
  employee_type: Pick<EmployeeTypeRow, 'id' | 'code' | 'label'> | null
  category: Pick<EmployeeCategoryRow, 'id' | 'name' | 'color'> | null
}

// עובדות פעילות בלבד — לשימוש ברשימות בחירה (SlotCell, שיבוץ יומי וכו')
export function useEmployees(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['employees', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(EMPLOYEE_SELECT)
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('full_name', { ascending: true })
      if (error) throw error
      return data as unknown as EmployeeWithType[]
    },
  })
}

// כל העובדות (כולל לא-פעילות), למסך "רשימת עובדות" — עם אפשרות לשחזור
export function useEmployeesOverview(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['employees-overview', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(EMPLOYEE_SELECT)
        .eq('school_id', schoolId!)
        .order('full_name', { ascending: true })
      if (error) throw error
      return data as unknown as EmployeeWithType[]
    },
  })
}

// תפקיד בסיס (מורה בוקר / מורה צהריים / סייעת / מ"מ קבועה וכו') — לרשימת הבחירה בטופס
export function useEmployeeTypes(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['employee-types', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_types')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as EmployeeTypeRow[]
    },
  })
}

export interface EmployeeFormInput {
  full_name: string
  employee_type_id: number
  phone: string | null
  email: string | null
  status: EmployeeStatus
  is_preferred: boolean
  notes: string | null
  category_id: number | null
}

interface CreateEmployeeInput extends EmployeeFormInput {
  schoolId: number
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, ...fields }: CreateEmployeeInput) => {
      const { data, error } = await supabase
        .from('employees')
        .insert({ school_id: schoolId, active: true, ...fields })
        .select()
        .single()
      if (error) throw error
      return data as EmployeeRow
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.schoolId] })
      queryClient.invalidateQueries({ queryKey: ['employees-overview', variables.schoolId] })
    },
  })
}

interface UpdateEmployeeInput extends Partial<EmployeeFormInput> {
  employeeId: number
  schoolId: number
  active?: boolean
}

// עריכת פרטי עובדת ו/או השבתה-שחזור. לא מוחקת בפועל — סעיף 3.1:
// "עובדת לא-פעילה נעלמת מרשימות הבחירה, ההיסטוריה שלה נשמרת".
export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, schoolId: _schoolId, ...patch }: UpdateEmployeeInput) => {
      const { error } = await supabase.from('employees').update(patch).eq('id', employeeId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.schoolId] })
      queryClient.invalidateQueries({ queryKey: ['employees-overview', variables.schoolId] })
    },
  })
}
