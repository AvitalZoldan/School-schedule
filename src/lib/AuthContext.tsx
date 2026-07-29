import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type PermissionLevel = 'full' | 'view_only'

export interface Profile {
  id: string
  school_id: number
  full_name: string
  permission_level: PermissionLevel
  active: boolean
  is_system_admin: boolean
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // טעינה ראשונית של session קיים (אם המשתמשת כבר התחברה בעבר בדפדפן הזה)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    let cancelled = false
    setLoading(true)

    // מרחיבים את auth.users עם השדות הספציפיים לאפליקציה מטבלת profiles
    // (school_id, permission_level) — ראו הערה בסכימה למה אין טבלת users נפרדת
    supabase
      .from('profiles')
      .select('id, school_id, full_name, permission_level, active, is_system_admin')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('שגיאה בטעינת פרופיל המשתמשת:', error.message)
          setProfile(null)
        } else {
          setProfile(data as Profile)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth חייב לפעול בתוך AuthProvider')
  return ctx
}
