import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('הסיסמה צריכה להכיל לפחות 6 תווים.')
      return
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError('לא הצלחנו לעדכן את הסיסמה. ייתכן שהקישור פג תוקף — בקשי קישור חדש.')
      return
    }

    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">טוען…</div>
    )
  }

  // אין session פעיל: או שהגיעו לכאן ישירות בלי קישור, או שהקישור כבר פג תוקף
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-[360px] rounded-xl border border-line bg-panel p-7 text-center shadow-sm">
          <div className="mb-3 text-lg font-bold text-ink">הקישור אינו תקף</div>
          <div className="mb-5 text-[13px] text-ink-soft">
            ייתכן שהקישור פג תוקף או שכבר נעשה בו שימוש. אפשר לבקש קישור חדש.
          </div>
          <Link
            to="/forgot-password"
            className="inline-block rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
          >
            בקשת קישור חדש
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[360px] rounded-xl border border-line bg-panel p-7 shadow-sm"
      >
        <div className="mb-6 text-center">
          <div className="text-lg font-bold text-ink">הגדרת סיסמה</div>
          <div className="mt-1 text-[13px] text-ink-soft">בחרי סיסמה חדשה לחשבון שלך</div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-[13px] text-ink-soft">סיסמה חדשה</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
            dir="ltr"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-[13px] text-ink-soft">אימות סיסמה</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
            dir="ltr"
          />
        </label>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent px-3 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'שומרת…' : 'שמירת סיסמה'}
        </button>
      </form>
    </div>
  )
}
