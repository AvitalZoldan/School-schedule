import { useState, type FormEvent } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useCreateContactRequest } from '../../hooks/useContactRequests'

interface Props {
  onClose: () => void
}

// טופס "צור קשר" הנפתח מהפוטר — שם ולפחות אחד מ(טלפון/מייל) הם שדות חובה, פירוט אופציונלי
export function ContactModal({ onClose }: Props) {
  const { profile } = useAuth()
  const createContactRequest = useCreateContactRequest()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [details, setDetails] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const trimmedName = fullName.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      setFormError('יש להזין שם')
      return
    }
    if (!trimmedPhone && !trimmedEmail) {
      setFormError('יש להזין טלפון או מייל')
      return
    }
    if (!profile) return

    try {
      await createContactRequest.mutateAsync({
        schoolId: profile.school_id,
        submittedBy: profile.id,
        fullName: trimmedName,
        phone: trimmedPhone || null,
        email: trimmedEmail || null,
        details: details.trim() || null,
      })
      setSent(true)
    } catch {
      setFormError('השליחה נכשלה. נסי שוב.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 text-ink shadow-lg">
        {sent ? (
          <>
            <h2 className="mb-3 text-lg font-bold">הפנייה נשלחה</h2>
            <p className="mb-5 text-[13px] text-ink-soft">פנייתך התקבלה ותיבדק בהקדם. תודה!</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              סגירה
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-bold">צור קשר</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">שם</span>
                <input
                  autoFocus
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">טלפון</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">מייל</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              <div className="text-[11.5px] text-ink-soft">יש להזין טלפון או מייל לפחות</div>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">פירוט</span>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              {formError && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{formError}</div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={createContactRequest.isPending}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {createContactRequest.isPending ? 'שולחת…' : 'שליחה'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
