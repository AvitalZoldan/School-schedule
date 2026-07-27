import { useMemo, useState } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useEmployeesOverview } from '../hooks/useEmployees'
import { useLeaves, useCancelLeave, type LeaveWithEmployee } from '../hooks/useLeaves'
import { useAuth } from '../lib/AuthContext'
import { useConfirm } from '../components/common/ConfirmProvider'
import { LeaveFormModal } from '../components/employees/LeaveFormModal'
import { parseISODate, toGregorianDateLabel, toISODate } from '../lib/dateUtils'

type LeaveStatusFilter = 'all' | 'active' | 'future' | 'finished' | 'cancelled'

const STATUS_LABELS: Record<Exclude<LeaveStatusFilter, 'all'>, string> = {
  active: 'פעילה',
  future: 'עתידית',
  finished: 'הסתיימה',
  cancelled: 'בוטלה',
}

function computeStatus(leave: LeaveWithEmployee, today: string): Exclude<LeaveStatusFilter, 'all'> {
  if (leave.status === 'cancelled') return 'cancelled'
  if (leave.end_date < today) return 'finished'
  if (leave.start_date > today) return 'future'
  return 'active'
}

// לשונית "חופשות" (3.7/5.4 באפיון): מסך תצוגה/היסטוריה בלבד — כל יצירת חופשה חדשה נעשית
// דרך כפתור "הוספת חופשה" במסך עובדות; כאן אפשר לצפות בכל החופשות (כולל היסטוריה), לסנן,
// ולערוך/לבטל חופשה קיימת.
export default function Leaves() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const canEdit = profile?.permission_level === 'full'

  const { data: leaves, isLoading } = useLeaves(schoolId)
  const { data: employees } = useEmployeesOverview(schoolId)
  const cancelLeave = useCancelLeave()
  const confirm = useConfirm()

  const [employeeFilter, setEmployeeFilter] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<LeaveStatusFilter>('all')
  const [editModal, setEditModal] = useState<LeaveWithEmployee | null>(null)

  const today = toISODate(new Date())

  const visibleLeaves = useMemo(() => {
    return (leaves ?? [])
      .filter((l) => employeeFilter === 'all' || l.employee_id === employeeFilter)
      .filter((l) => statusFilter === 'all' || computeStatus(l, today) === statusFilter)
  }, [leaves, employeeFilter, statusFilter, today])

  async function handleCancel(leave: LeaveWithEmployee) {
    if (!schoolId) return
    const hasSubDays = (leave.leave_day_assignments ?? []).length > 0
    const message = hasSubDays
      ? 'האם את בטוחה שברצונך לבטל את החופשה? מ"מ שכבר שובצו כמחליפות יימחקו.'
      : 'האם את בטוחה שברצונך לבטל את החופשה?'
    if (!(await confirm(message))) return
    cancelLeave.mutate({ schoolId, leaveId: leave.id })
  }

  const editEmployee = editModal
    ? (employees ?? []).find((e) => e.id === editModal.employee_id)
    : null

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">חופשות</h1>
          <div className="mt-1 text-[13px] text-ink-soft">
            היסטוריית כל החופשות שנרשמו במערכת. הוספת חופשה חדשה מתבצעת דרך מסך "רשימת עובדות".
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-lg border border-line bg-white px-3 py-2 text-[13px]"
        >
          <option value="all">כל העובדות</option>
          {employees?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeaveStatusFilter)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-[13px]"
        >
          <option value="all">כל הסטטוסים</option>
          {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">עובדת</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">התחלה</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">סיום מתוכנן</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">סטטוס</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">ימי מ"מ משויכים</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">הערות</th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
              </tr>
            ) : visibleLeaves.length > 0 ? (
              visibleLeaves.map((leave) => {
                const status = computeStatus(leave, today)
                const editable = canEdit && status !== 'cancelled'
                return (
                  <tr key={leave.id}>
                    <td className="border-t border-line px-3 py-2 font-medium">
                      {leave.employee?.full_name ?? '—'}
                    </td>
                    <td className="border-t border-line px-3 py-2">
                      {toGregorianDateLabel(parseISODate(leave.start_date))}
                    </td>
                    <td className="border-t border-line px-3 py-2">
                      {toGregorianDateLabel(parseISODate(leave.end_date))}
                    </td>
                    <td className="border-t border-line px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          status === 'active'
                            ? 'bg-ok-soft text-ok'
                            : status === 'future'
                              ? 'bg-accent-soft text-accent'
                              : status === 'cancelled'
                                ? 'bg-danger-soft text-danger'
                                : 'bg-[#f2f0ea] text-ink-soft'
                        }`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="border-t border-line px-3 py-2">
                      {(leave.leave_day_assignments ?? []).length}
                    </td>
                    <td className="border-t border-line px-3 py-2 max-w-[220px] truncate" title={leave.notes ?? ''}>
                      {leave.notes ?? '—'}
                    </td>
                    <td className="border-t border-line px-3 py-2">
                      {editable && (
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditModal(leave)}
                            className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                          >
                            עריכה
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(leave)}
                            className="rounded-md border border-line px-2.5 py-1 text-[12px] text-danger hover:bg-[#f2f0ea]"
                          >
                            ביטול
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-ink-soft">
                  אין חופשות התואמות את הסינון הנבחר.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editModal && editEmployee && schoolId && (
        <LeaveFormModal
          schoolId={schoolId}
          employee={editEmployee}
          existingLeave={editModal}
          createdBy={profile?.id ?? null}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}
