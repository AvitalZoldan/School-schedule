import { useEffect, useMemo, useState } from 'react'
import {
  useContactRequests,
  useMarkContactRequestRead,
  useSetContactRequestHandled,
  type ContactRequestRow,
} from '../hooks/useContactRequests'
import { useSchools } from '../hooks/useSchools'
import { toGregorianDateLabel, toLocalTimeLabel } from '../lib/dateUtils'
import { ColumnFilter } from '../components/common/ColumnFilter'
import { useColumnFilters, matchesOption, matchesText } from '../hooks/useColumnFilters'

type Filter = 'all' | 'unread'

const STATUS_LABELS = { new: 'חדש', seen: 'נצפה', handled: 'טופל' } as const
type StatusValue = keyof typeof STATUS_LABELS

function requestStatus(req: ContactRequestRow): StatusValue {
  if (req.handled_at) return 'handled'
  if (req.read_at) return 'seen'
  return 'new'
}

const FILTER_COLUMNS = ['date', 'name', 'school', 'status'] as const

// לשונית "פניות משתמשים" — טופס "צור קשר" בפוטר, נגישה רק למנהל/ת מערכת ראשי/ת (RequireSystemAdmin + RLS)
export default function ContactRequests() {
  const { data: requests, isLoading } = useContactRequests()
  const { data: schools } = useSchools()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<ContactRequestRow | null>(null)
  const { filters } = useColumnFilters(FILTER_COLUMNS)

  const schoolsById = useMemo(() => new Map((schools ?? []).map((s) => [s.id, s.name])), [schools])
  const schoolName = (schoolId: number) => schoolsById.get(schoolId) ?? '—'

  const schoolOptions = useMemo(
    () =>
      [...(schools ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name, 'he'))
        .map((s) => ({ value: String(s.id), label: s.name })),
    [schools],
  )
  const statusOptions = useMemo(
    () => (Object.entries(STATUS_LABELS) as [StatusValue, string][]).map(([value, label]) => ({ value, label })),
    [],
  )

  const visibleRequests = useMemo(
    () =>
      (requests ?? []).filter((r) => {
        if (filter === 'unread' && r.read_at) return false

        const dateLabel = `${toGregorianDateLabel(new Date(`${r.created_at}Z`))} ${toLocalTimeLabel(r.created_at)}`
        if (!matchesText(filters.date.value, dateLabel)) return false

        if (!matchesText(filters.name.value, r.full_name)) return false

        if (!matchesOption(filters.school.value, String(r.school_id))) return false
        if (!matchesText(filters.school.value, schoolsById.get(r.school_id) ?? '—')) return false

        const status = requestStatus(r)
        if (!matchesOption(filters.status.value, status)) return false
        if (!matchesText(filters.status.value, STATUS_LABELS[status])) return false

        return true
      }),
    [requests, filter, filters, schoolsById],
  )
  const unreadCount = (requests ?? []).filter((r) => !r.read_at).length

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">פניות משתמשים</h1>
      </div>

      <div className="mb-4 flex gap-1 border-b border-line print:hidden">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={[
            'px-3 py-2 text-[13.5px] font-medium',
            filter === 'all' ? 'border-b-2 border-accent text-accent' : 'text-ink-soft hover:text-ink',
          ].join(' ')}
        >
          הכל
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={[
            'px-3 py-2 text-[13.5px] font-medium',
            filter === 'unread' ? 'border-b-2 border-accent text-accent' : 'text-ink-soft hover:text-ink',
          ].join(' ')}
        >
          לא נצפו {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                תאריך
                <ColumnFilter filter={filters.date} />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                שם
                <ColumnFilter filter={filters.name} />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                בית ספר
                <ColumnFilter filter={filters.school} options={schoolOptions} />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                סטטוס
                <ColumnFilter filter={filters.status} options={statusOptions} />
              </th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
              </tr>
            ) : visibleRequests.length > 0 ? (
              visibleRequests.map((req) => (
                <tr key={req.id} className={req.read_at ? '' : 'font-medium'}>
                  <td className="whitespace-nowrap border-t border-line px-3 py-2 text-ink-soft">
                    {toGregorianDateLabel(new Date(`${req.created_at}Z`))} {toLocalTimeLabel(req.created_at)}
                  </td>
                  <td className="border-t border-line px-3 py-2">{req.full_name}</td>
                  <td className="border-t border-line px-3 py-2">{schoolName(req.school_id)}</td>
                  <td className="border-t border-line px-3 py-2">
                    {req.handled_at ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">טופל</span>
                    ) : req.read_at ? (
                      <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[11px] text-[#999]">נצפה</span>
                    ) : (
                      <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] text-warn">חדש</span>
                    )}
                  </td>
                  <td className="border-t border-line px-3 py-2">
                    <div className="flex justify-end print:hidden">
                      <button
                        type="button"
                        onClick={() => setSelected(req)}
                        className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                      >
                        פרטים
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink-soft">
                  {(requests ?? []).length === 0
                    ? 'אין עדיין פניות.'
                    : filter === 'unread'
                      ? 'אין פניות שלא נצפו התואמות את הסינון.'
                      : 'אין פניות התואמות את הסינון.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <ContactRequestDetailModal
          request={selected}
          schoolName={schoolName(selected.school_id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function ContactRequestDetailModal({
  request,
  schoolName,
  onClose,
}: {
  request: ContactRequestRow
  schoolName: string
  onClose: () => void
}) {
  const markRead = useMarkContactRequestRead()
  const setHandled = useSetContactRequestHandled()

  useEffect(() => {
    if (!request.read_at) markRead.mutate(request.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 text-ink shadow-lg">
        <h2 className="mb-4 text-lg font-bold">{request.full_name}</h2>

        <dl className="mb-4 flex flex-col gap-2 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-ink-soft">תאריך</dt>
            <dd>
              {toGregorianDateLabel(new Date(`${request.created_at}Z`))} {toLocalTimeLabel(request.created_at)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">בית ספר</dt>
            <dd>{schoolName}</dd>
          </div>
          {request.phone && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">טלפון</dt>
              <dd dir="ltr">{request.phone}</dd>
            </div>
          )}
          {request.email && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">מייל</dt>
              <dd dir="ltr">{request.email}</dd>
            </div>
          )}
          {request.details && (
            <div>
              <dt className="mb-1 text-ink-soft">פירוט</dt>
              <dd className="whitespace-pre-wrap">{request.details}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              const handled = !request.handled_at
              setHandled.mutate({ requestId: request.id, handled })
              if (handled) onClose()
            }}
            className="rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
          >
            {request.handled_at ? 'ביטול סימון כטופל' : 'סימון כטופל'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            סגירה
          </button>
        </div>
      </div>
    </div>
  )
}
