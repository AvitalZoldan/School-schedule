import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Criticality, DayPart, RoleTypeDefaultRow, RoleTypeRow } from '../types/schedule'

export interface RoleTypeWithDefaults extends RoleTypeRow {
  defaults: RoleTypeDefaultRow[]
}

// כל התפקידים של בית הספר (כולל לא-פעילים), עם ברירות המחדל שלהם לכל חלק-יום —
// למסך "ניהול" ולבניית תבנית ברירת מחדל בעת יצירת כיתה
export function useRoleTypesOverview(schoolId: number | undefined) {
  return useQuery({
    queryKey: ['role-types-overview', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [typesRes, defaultsRes] = await Promise.all([
        supabase.from('role_types').select('*').eq('school_id', schoolId!).order('sort_order', { ascending: true }),
        supabase.from('role_type_defaults').select('*').eq('school_id', schoolId!),
      ])
      if (typesRes.error) throw typesRes.error
      if (defaultsRes.error) throw defaultsRes.error
      const types = typesRes.data as RoleTypeRow[]
      const defaults = defaultsRes.data as RoleTypeDefaultRow[]
      return types.map((t) => ({ ...t, defaults: defaults.filter((d) => d.role_type_id === t.id) })) as RoleTypeWithDefaults[]
    },
  })
}

function invalidateRoleTypes(queryClient: ReturnType<typeof useQueryClient>, schoolId: number) {
  queryClient.invalidateQueries({ queryKey: ['role-types-overview', schoolId] })
}

interface CreateRoleTypeInput {
  schoolId: number
  name: string
  sortOrder: number
}

export function useCreateRoleType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, name, sortOrder }: CreateRoleTypeInput) => {
      const { data, error } = await supabase
        .from('role_types')
        .insert({ school_id: schoolId, name, sort_order: sortOrder, active: true })
        .select()
        .single()
      if (error) throw error
      const roleTypeId = (data as RoleTypeRow).id
      const { error: defaultsError } = await supabase.from('role_type_defaults').insert([
        { school_id: schoolId, role_type_id: roleTypeId, day_part: 'morning', count: 0, criticality: 'normal' },
        { school_id: schoolId, role_type_id: roleTypeId, day_part: 'afternoon', count: 0, criticality: 'normal' },
      ])
      if (defaultsError) throw defaultsError
    },
    onSuccess: (_data, variables) => invalidateRoleTypes(queryClient, variables.schoolId),
  })
}

interface UpdateRoleTypeInput {
  roleTypeId: number
  schoolId: number
  name?: string
  active?: boolean
}

export function useUpdateRoleType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ roleTypeId, schoolId: _schoolId, ...patch }: UpdateRoleTypeInput) => {
      const { error } = await supabase.from('role_types').update(patch).eq('id', roleTypeId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => invalidateRoleTypes(queryClient, variables.schoolId),
  })
}

interface UpdateRoleTypeDefaultInput {
  schoolId: number
  roleTypeId: number
  dayPart: DayPart
  count?: number
  criticality?: Criticality
}

// עדכון כמות/קריטיות ברירת המחדל של תפקיד לחלק-יום נתון (upsert — הצירוף role_type_id+day_part ייחודי)
export function useUpdateRoleTypeDefault() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ schoolId, roleTypeId, dayPart, count, criticality }: UpdateRoleTypeDefaultInput) => {
      const { error } = await supabase
        .from('role_type_defaults')
        .update({ count, criticality })
        .eq('role_type_id', roleTypeId)
        .eq('day_part', dayPart)
      if (error) throw error
    },
    onSuccess: (_data, variables) => invalidateRoleTypes(queryClient, variables.schoolId),
  })
}
