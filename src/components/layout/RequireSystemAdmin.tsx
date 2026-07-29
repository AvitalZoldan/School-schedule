import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

export function RequireSystemAdmin({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink-soft">טוען…</div>
  }

  if (!profile?.is_system_admin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
