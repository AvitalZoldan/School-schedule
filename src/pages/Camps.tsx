import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useCamps } from '../hooks/useCamps'
import type { CampWithPeriods } from '../types/camps'
import { useAuth } from '../lib/AuthContext'
import { CampFormModal } from '../components/camps/CampFormModal'
import { parseISODate, toGregorianDateLabel, toISODate } from '../lib/dateUtils'

type CampStatus = 'future' | 'active' | 'finished'

const STATUS_LABELS: Record<CampStatus, string> = {
  future: 'עתידית',
  active: 'פעילה',
  finished: 'הסתיימה',
}

function computeStatus(camp: CampWithPeriods, today: string): CampStatus {
  if (camp.end_date < today) return 'finished'
  if (camp.start_date > today) return 'future'
  return 'active'
}

// מסך "ניהול קייטנות" (3.10/5.3): רשימת כל הקייטנות שהוגדרו אי-פעם (נשמרות להיסטוריה
// לצמיתות, אין אפשרות מחיקה — רק עריכה). כל קייטנה עצמאית: שיבוץ בסיסי, שיבוץ מ"מ יומי
// ומערכת פתיחות משלה נמצאים במסך הפרטים (CampDetail.tsx).
export default function Camps() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const canEdit = profile?.permission_level === 'full'

  const { data: camps, isLoading } = useCamps(schoolId)
  const [modal, setModal] = useState<{ kind: 'create' } | { kind: 'edit'; camp: CampWithPeriods } | null>(null)

  const today = toISODate(new Date())

  const sortedCamps = useMemo(() => {
    return [...(camps ?? [])].sort((a, b) => {
      const statusOrder: Record<CampStatus, number> = { active: 0, future: 1, finished: 2 }
      const sa = computeStatus(a, today)
      const sb = computeStatus(b, today)
      if (statusOrder[sa] !== statusOrder[sb]) return statusOrder[sa] - statusOrder[sb]
      return b.start_date.localeCompare(a.start_date)
    })
  }, [camps, today])

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ניהול קייטנות</h1>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'create' })}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 print:hidden"
          >
            הוספת קייטנה +
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">שם</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">טווח כולל</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">סטטוס</th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
              </tr>
            ) : sortedCamps.length > 0 ? (
              sortedCamps.map((camp) => {
                const status = computeStatus(camp, today)
                return (
                  <tr key={camp.id}>
                    <td className="border-t border-line px-3 py-2 font-medium">{camp.name}</td>
                    <td className="border-t border-line px-3 py-2">
                      {toGregorianDateLabel(parseISODate(camp.start_date))} –{' '}
                      {toGregorianDateLabel(parseISODate(camp.end_date))}
                    </td>
                    <td className="border-t border-line px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          status === 'active'
                            ? 'bg-ok-soft text-ok'
                            : status === 'future'
                              ? 'bg-accent-soft text-accent'
                              : 'bg-[#f2f0ea] text-ink-soft'
                        }`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="border-t border-line px-3 py-2">
                      <div className="flex justify-end gap-1.5 print:hidden">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setModal({ kind: 'edit', camp })}
                            title="עריכה"
                            aria-label="עריכה"
                            className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea]"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <Link
                          to={`/camps/${camp.id}`}
                          className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                        >
                          כניסה
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-ink-soft">
                  אין עדיין קייטנות מוגדרות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && schoolId && (
        <CampFormModal
          schoolId={schoolId}
          existingCamp={modal.kind === 'edit' ? modal.camp : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
