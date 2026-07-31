import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PermissionLevel } from '../lib/AuthContext'

// כל המשתמשים בכל בתי-הספר, כולל מייל — נטען דרך RPC (SECURITY DEFINER) כי auth.users
// לא נגישה ישירות מהקליינט. מוגן בצד השרת: זורק שגיאה אם הקוראת אינה מנהלת מערכת/בית ספר.
// מנהלת בית ספר מקבלת בחזרה רק את המשתמשות של בית הספר שלה (ראו admin_list_profiles ב-DB).
export interface AdminProfileRow {
  id: string
  school_id: number
  school_name: string
  full_name: string
  permission_level: PermissionLevel
  active: boolean
  is_system_admin: boolean
  is_school_admin: boolean
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

// זמינה גם למנהלת מערכת וגם למנהלת בית ספר — עבור מנהלת בית ספר ה-school_id מתעלם בצד השרת
// ומוחלף תמיד בבית הספר שלה (ראו admin-invite-user)
export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: InviteUserInput) => {
      const { data, error } = await supabase.functions.invoke('admin-invite-user', {
        body: { ...input, redirect_to: `${window.location.origin}/reset-password` },
      })
      if (error) {
        // כשה-edge function מחזירה קוד שגיאה (400/403), supabase-js לא ממלא את data — צריך
        // לקרוא את גוף התגובה בעצמנו כדי לקבל את הודעת השגיאה המפורטת (בעברית) ולא הודעה גנרית
        const context = (error as { context?: Response }).context
        if (context) {
          const body = await context.json().catch(() => null)
          if (body?.error) throw new Error(body.error)
        }
        throw error
      }
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
  is_school_admin?: boolean
}

// עדכון ישיר של פרופיל — נגיש רק למנהלת מערכת (RLS admin_update_all_profiles), כולל שינוי
// בית ספר/הרשאות מנהל. לשימוש מלשונית "ניהול מערכת" בלבד.
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

// עדכון הרשאה/סטטוס פעיל ע"י מנהלת בית ספר — מוגבל בצד השרת למשתמשות בבית הספר שלה בלבד,
// ואינו מאפשר לגעת במנהלות מערכת/בית ספר אחרות (ראו school_admin_update_profile ב-DB)
export function useSchoolAdminUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      profileId,
      permissionLevel,
      active,
    }: {
      profileId: string
      permissionLevel: PermissionLevel
      active: boolean
    }) => {
      const { error } = await supabase.rpc('school_admin_update_profile', {
        target_id: profileId,
        new_permission_level: permissionLevel,
        new_active: active,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
    },
  })
}
