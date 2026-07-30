import { useState, type FormEvent } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { WEEKDAY_LABELS } from '../types/schedule'
import {
  useOpeningRoster,
  useMorningStaffByWeekday,
  useCreateOpeningRole,
} from '../hooks/useOpeningRoster'
import { OpeningCell } from '../components/opening/OpeningCell'
import { useAuth } from '../lib/AuthContext'

const WEEKDAYS = [1, 2, 3, 4, 5, 6]

export default function Opening() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const canEdit = profile?.permission_level === 'full'

  const { data: roster, isLoading } = useOpeningRoster(schoolId)
  const { data: morningStaffByWeekday } = useMorningStaffByWeekday(schoolId)
  const createRole = useCreateOpeningRole()

  const [modalOpen, setModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function openModal() {
    setNewRoleName('')
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!schoolId) return

    const trimmed = newRoleName.trim()
    if (!trimmed) {
      setFormError('יש להזין שם תפקיד')
      return
    }

    try {
      await createRole.mutateAsync({
        schoolId,
        name: trimmed,
        sortOrder: (roster?.length ?? 0) + 1,
      })
      setModalOpen(false)
    } catch {
      setFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">מערכת פתיחות</h1>
          <div className="mt-1 text-[13px] text-ink-soft">
            טבלה שבועית קבועה — תפקיד פתיחה × יום בשבוע, פעם אחת ביום (לא מחולק בוקר/צהריים)
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openModal}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 print:hidden"
          >
            + הוספת תפקיד
          </button>
        )}
      </div>

      {/* table-fixed: העמודות מתחלקות ברוחב הזמין ולא גולשות — בלי גלילה אופקית.
          תוכן ארוך (שם/הערה) עובר שורה במקום לגלוש. */}
      <div className="rounded-xl border border-line bg-panel">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <colgroup>
            <col className="w-[110px]" />
            {WEEKDAYS.map((wd) => (
              <col key={wd} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="border-b border-line px-2 py-2.5 text-right text-[12px] text-ink-soft">
                תפקיד
              </th>
              {WEEKDAYS.map((wd) => (
                <th
                  key={wd}
                  className="border-b border-line px-1.5 py-2.5 text-right text-[12px] text-ink-soft"
                >
                  {WEEKDAY_LABELS[wd]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={WEEKDAYS.length + 1} className="px-3 py-4 text-center text-ink-soft">
                  טוען…
                </td>
              </tr>
            ) : roster && roster.length > 0 ? (
              roster.map((role) => (
                <tr key={role.id}>
                  <td className="border-t border-line px-2 py-2 text-[12.5px] font-medium">
                    {role.name}
                  </td>
                  {WEEKDAYS.map((wd) =>
                    schoolId ? (
                      <OpeningCell
                        key={wd}
                        schoolId={schoolId}
                        roleId={role.id}
                        weekday={wd}
                        assignment={role.assignments[wd]}
                        availableEmployees={morningStaffByWeekday?.[wd] ?? []}
                        roster={roster ?? []}
                      />
                    ) : (
                      <td key={wd} />
                    ),
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={WEEKDAYS.length + 1} className="px-3 py-4 text-center text-ink-soft">
                  אין עדיין תפקידי פתיחה מוגדרים.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-2.5 text-[12px] text-ink-soft">
          רשימת הבחירה בכל יום מוגבלת לעובדות המשובצות לחור בוקר כלשהו, בכיתה כלשהי, ביום זה
          (מהשיבוץ הבסיסי הפעיל). תא לא-מאויש מודגש באדום.
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[360px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">הוספת תפקיד פתיחה</h2>
            <form onSubmit={handleSubmit}>
              <label className="mb-3 block">
                <span className="mb-1 block text-[13px] text-ink-soft">שם תפקיד</span>
                <input
                  autoFocus
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="לדוגמה: וידאו בכיתת שקד"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              {formError && (
                <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
                  {formError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={createRole.isPending}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {createRole.isPending ? 'שומרת…' : 'הוספה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
