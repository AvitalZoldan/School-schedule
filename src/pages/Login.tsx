import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)

    if (signInError) {
      setError('אימייל או סיסמה שגויים. נסי שוב.')
      return
    }

    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[360px] rounded-xl border border-line bg-panel p-7 shadow-sm"
      >
        <div className="mb-6 text-center">
          <div className="text-lg font-bold text-ink">מערך צוות</div>
          <div className="mt-1 text-[13px] text-ink-soft">מערכת שיבוץ בית-ספרית</div>
        </div>

        <label className="mb-3 block">
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

        <label className="mb-4 block">
          <span className="mb-1 block text-[13px] text-ink-soft">סיסמה</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {submitting ? 'רק רגע...' : 'התחברות'}
        </button>

        <Link
          to="/forgot-password"
          className="mt-4 block text-center text-[13px] text-accent hover:underline"
        >
          שכחת סיסמה?
        </Link>
      </form>
    </div>
  )
}
