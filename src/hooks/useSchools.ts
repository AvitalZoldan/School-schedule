import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { SchoolRow } from '../types/schedule'

// כל בתי-הספר במערכת — למסך ניהול המערכת (מנהל מערכת בלבד, ראו RLS: admin_select_all_schools)
export function useSchools() {
  return useQuery({
    queryKey: ['admin-schools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data as SchoolRow[]
    },
  })
}

export function useCreateSchool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('schools')
        .insert({ name, active: true })
        .select()
        .single()
      if (error) throw error
      return data as SchoolRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schools'] })
    },
  })
}

interface UpdateSchoolInput {
  schoolId: number
  name?: string
  active?: boolean
  max_full_access_users?: number
}

export function useUpdateSchool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, ...patch }: UpdateSchoolInput) => {
      const { error } = await supabase.from('schools').update(patch).eq('id', schoolId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schools'] })
    },
  })
}
