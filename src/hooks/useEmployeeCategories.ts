import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { EmployeeCategoryRow } from '../types/schedule'

// קטגוריות פעילות בלבד — לשימוש ברשימת הבחירה בטופס עובדת ובמסנן החיפוש
export function useEmployeeCategories(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['employee-categories', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_categories')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as EmployeeCategoryRow[]
    },
  })
}

// כולל לא-פעילות — למסך "ניהול" (עם אפשרות שחזור)
export function useEmployeeCategoriesOverview(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['employee-categories-overview', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_categories')
        .select('*')
        .eq('school_id', schoolId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as EmployeeCategoryRow[]
    },
  })
}

function invalidateCategories(queryClient: ReturnType<typeof useQueryClient>, schoolId: number) {
  queryClient.invalidateQueries({ queryKey: ['employee-categories', schoolId] })
  queryClient.invalidateQueries({ queryKey: ['employee-categories-overview', schoolId] })
  // צבע/שם קטגוריה מוצגים גם בתוך רשימת העובדות עצמה (JOIN) — יש לרענן גם אותה
  queryClient.invalidateQueries({ queryKey: ['employees', schoolId] })
  queryClient.invalidateQueries({ queryKey: ['employees-overview', schoolId] })
}

interface CreateEmployeeCategoryInput {
  schoolId: number
  name: string
  color: string
  sortOrder: number
}

export function useCreateEmployeeCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, name, color, sortOrder }: CreateEmployeeCategoryInput) => {
      const { error } = await supabase
        .from('employee_categories')
        .insert({ school_id: schoolId, name, color, sort_order: sortOrder, active: true })
      if (error) throw error
    },
    onSuccess: (_data, variables) => invalidateCategories(queryClient, variables.schoolId),
  })
}

interface UpdateEmployeeCategoryInput {
  categoryId: number
  schoolId: number
  name?: string
  color?: string
  active?: boolean
}

export function useUpdateEmployeeCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ categoryId, schoolId: _schoolId, ...patch }: UpdateEmployeeCategoryInput) => {
      const { error } = await supabase.from('employee_categories').update(patch).eq('id', categoryId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => invalidateCategories(queryClient, variables.schoolId),
  })
}
