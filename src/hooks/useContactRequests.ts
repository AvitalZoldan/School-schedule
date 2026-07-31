import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ContactRequestRow {
  id: number
  school_id: number
  submitted_by: string
  full_name: string
  phone: string | null
  email: string | null
  details: string | null
  created_at: string
  read_at: string | null
  handled_at: string | null
}

interface CreateContactRequestInput {
  schoolId: number
  submittedBy: string
  fullName: string
  phone: string | null
  email: string | null
  details: string | null
}

// יצירת פניית "צור קשר" מהפוטר — נגישה לכל משתמשת פעילה (גם צפייה בלבד), ראה RLS insert_own
export function useCreateContactRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateContactRequestInput) => {
      const { error } = await supabase.from('contact_requests').insert({
        school_id: input.schoolId,
        submitted_by: input.submittedBy,
        full_name: input.fullName,
        phone: input.phone,
        email: input.email,
        details: input.details,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-requests'] }),
  })
}

// רשימת כל פניות המשתמשות בכל בתי הספר — נגישה רק למנהל/ת מערכת ראשי/ת (RLS select_system_admin)
export function useContactRequests() {
  return useQuery({
    queryKey: ['contact-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ContactRequestRow[]
    },
  })
}

// מסמן פנייה כנצפתה — נקרא אוטומטית בפתיחת פרטי הפנייה (ראה ContactRequests.tsx). הדף מיועד
// למנהל מערכת יחיד, ולכן זהו שדה גלובלי (read_at) ולא מעקב פר-משתמש.
export function useMarkContactRequestRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: number) => {
      const { error } = await supabase
        .from('contact_requests')
        .update({ read_at: new Date().toISOString() })
        .eq('id', requestId)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-requests'] }),
  })
}

// סימון/ביטול סימון פנייה כטופלה
export function useSetContactRequestHandled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ requestId, handled }: { requestId: number; handled: boolean }) => {
      const { error } = await supabase
        .from('contact_requests')
        .update({ handled_at: handled ? new Date().toISOString() : null })
        .eq('id', requestId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-requests'] }),
  })
}
