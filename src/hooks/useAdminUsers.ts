import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PermissionLevel } from '../lib/AuthContext'

// כל המשתמשים בכל בתי-הספר, כולל מייל — נטען דרך RPC (SECURITY DEFINER) כי auth.users
// לא נגישה ישירות מהקליינט. מוגן בצד השרת: זורק שגיאה אם הקוראת אינה מנהלת מערכת.
export interface AdminProfileRow {
  id: string
  school_id: number
  school_name: string
  full_name: string
  permission_level: PermissionLevel
  active: boolean
  is_system_admin: boolean
  email: string
}

export function useAdminProfiles() {
  return useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_profiles')
      if (error) throw error
      return data as AdminProfileRow[]
    },
  })
}

interface InviteUserInput {
  email: string
  full_name: string
  school_id: number
  permission_level: PermissionLevel
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: InviteUserInput) => {
      const { data, error } = await supabase.functions.invoke('admin-invite-user', {
        body: { ...input, redirect_to: `${window.location.origin}/reset-password` },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as { ok: true; id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
    },
  })
}

interface UpdateAdminProfileInput {
  profileId: string
  school_id?: number
  permission_level?: PermissionLevel
  active?: boolean
  is_system_admin?: boolean
}

export function useUpdateAdminProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, ...patch }: UpdateAdminProfileInput) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', profileId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
    },
  })
}
