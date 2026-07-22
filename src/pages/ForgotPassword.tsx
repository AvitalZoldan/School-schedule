import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    // שולח מייל עם קישור; הקישור מפנה חזרה ל-/reset-password עם session זמני
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setSubmitting(false)

    if (resetError) {
      setError('לא הצלחנו לשלוח את המייל. בדקי שהאימייל נכון ונסי שוב.')
      return
    }

    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-[360px] rounded-xl border border-line bg-panel p-7 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-lg font-bold text-ink">איפוס סיסמה</div>
          <div className="mt-1 text-[13px] text-ink-soft">
            נשלח לך קישור לאימייל להגדרת סיסמה חדשה
          </div>
        </div>

        {sent ? (
          <div className="rounded-lg bg-accent-soft px-3 py-3 text-[13px] text-accent">
            נשלח מייל אל {email} עם קישור להגדרת סיסמה. אם לא רואה אותו, כדאי לבדוק גם בתיקיית
            הספאם.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="mb-4 block">
              <span className="mb-1 block text-[13px] text-ink-soft">אימייל</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {submitting ? 'שולחת…' : 'שליחת קישור'}
            </button>
          </form>
        )}

        <Link to="/login" className="mt-4 block text-center text-[13px] text-accent hover:underline">
          חזרה להתחברות
        </Link>
      </div>
    </div>
  )
}
