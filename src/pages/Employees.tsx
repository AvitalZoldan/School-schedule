import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Calendar, CalendarPlus, Trash2, RotateCcw, type LucideIcon } from 'lucide-react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import {
  useEmployeesOverview,
  useEmployeeTypes,
  useCreateEmployee,
  useUpdateEmployee,
  type EmployeeWithType,
  type EmployeeFormInput,
} from '../hooks/useEmployees'
import { useEmployeeCategories } from '../hooks/useEmployeeCategories'
import { useEmployeeScheduledHours } from '../hooks/useEmployeeScheduledHours'
import { useLeaves, useCancelLeave, type LeaveWithEmployee } from '../hooks/useLeaves'
import { toISODate } from '../lib/dateUtils'
import { EMPLOYEE_STATUS_LABELS, type EmployeeStatus } from '../types/schedule'
import { useAuth } from '../lib/AuthContext'
import { useConfirm } from '../components/common/ConfirmProvider'
import { LeaveFormModal } from '../components/employees/LeaveFormModal'
import { ImportEmployeesModal } from '../components/employees/ImportEmployeesModal'
import { ColumnFilter } from '../components/common/ColumnFilter'
import { Pagination } from '../components/common/Pagination'
import { useColumnFilters, matchesOption, matchesText, matchesNumberRange } from '../hooks/useColumnFilters'
import { usePagination } from '../hooks/usePagination'

const PAGE_SIZE = 20

type ModalMode = { kind: 'create' } | { kind: 'edit'; employee: EmployeeWithType }

const FILTER_COLUMNS = ['name', 'role', 'category', 'status', 'hours', 'phone', 'email', 'notes'] as const

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

// אייקון לוח שנה עם תג פעולה קטן בפינה (עיפרון לעריכת חופשה, פח למחיקתה) — כדי להבחין
// חזותית בין פעולות על חופשה קיימת לבין שאר כפתורי העריכה/מחיקה הרגילים באפליקציה
function CalendarBadgeIcon({ badge: Badge }: { badge: LucideIcon }) {
  return (
    <span className="relative inline-flex">
      <Calendar size={14} />
      <Badge size={9} className="absolute -bottom-1 -left-1 rounded-full bg-white" strokeWidth={2.5} />
    </span>
  )
}

const emptyForm: EmployeeFormInput = {
  full_name: '',
  employee_type_id: 0,
  phone: '',
  email: '',
  status: 'permanent',
  is_preferred: false,
  notes: '',
  category_id: null,
}

export default function Employees() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const canEdit = profile?.permission_level === 'full'

  const { data: employees, isLoading } = useEmployeesOverview(schoolId)
  const { data: employeeTypes } = useEmployeeTypes(schoolId)
  const { data: categories } = useEmployeeCategories(schoolId)
  const { data: leaves } = useLeaves(schoolId)
  const { data: scheduledHoursByEmployeeId } = useEmployeeScheduledHours(schoolId)
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const cancelLeave = useCancelLeave()
  const confirm = useConfirm()

  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [form, setForm] = useState<EmployeeFormInput>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [leaveModalEmployee, setLeaveModalEmployee] = useState<EmployeeWithType | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const { filters, isAnyActive: isFiltered } = useColumnFilters(FILTER_COLUMNS)
  const [searchParams, setSearchParams] = useSearchParams()

  const roleOptions = useMemo(
    () => (employeeTypes ?? []).map((t) => ({ value: String(t.id), label: t.label })),
    [employeeTypes],
  )
  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'ללא קטגוריה' },
      ...(categories ?? []).map((c) => ({ value: String(c.id), label: c.name, color: c.color })),
    ],
    [categories],
  )
  const statusOptions = useMemo(
    () => Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    [],
  )

  // עבור כל עובדת קבועה, החופשה הפעילה/עתידית האחרונה שלה (אם יש) — לכפתור "ניהול/הוספת חופשה" (3.7)
  const currentLeaveByEmployeeId = useMemo(() => {
    const today = toISODate(new Date())
    const map = new Map<number, LeaveWithEmployee>()
    for (const leave of leaves ?? []) {
      if (leave.status !== 'active' || leave.end_date < today) continue
      const existing = map.get(leave.employee_id)
      if (!existing || leave.start_date < existing.start_date) map.set(leave.employee_id, leave)
    }
    return map
  }, [leaves])

  // התראה (לא חוסמת) על שם שכבר קיים בבית הספר — בין אם עובדת פעילה או לא, לא כולל את
  // העובדת הנוכחית עצמה כשעורכים
  const duplicateNameWarning = useMemo(() => {
    const trimmed = form.full_name.trim().toLowerCase()
    if (!trimmed) return false
    return (employees ?? []).some(
      (e) => e.full_name.trim().toLowerCase() === trimmed && (modal?.kind !== 'edit' || e.id !== modal.employee.id),
    )
  }, [employees, form.full_name, modal])

  const visibleEmployees = useMemo(() => {
    return (employees ?? []).filter((e) => {
      if (!(e.active || showInactive)) return false
      if (!matchesText(filters.name.value, e.full_name)) return false

      if (!matchesOption(filters.role.value, String(e.employee_type_id))) return false
      if (!matchesText(filters.role.value, e.employee_type?.label ?? '')) return false

      if (!matchesOption(filters.category.value, e.category ? String(e.category.id) : '')) return false
      if (!matchesText(filters.category.value, e.category?.name ?? '')) return false

      if (!matchesOption(filters.status.value, e.status)) return false
      if (!matchesText(filters.status.value, EMPLOYEE_STATUS_LABELS[e.status])) return false

      if (!matchesNumberRange(filters.hours.value, scheduledHoursByEmployeeId?.get(e.id) ?? 0)) return false

      if (!matchesText(filters.phone.value, e.phone ?? '')) return false
      if (!matchesText(filters.email.value, e.email ?? '')) return false
      if (!matchesText(filters.notes.value, e.notes ?? '')) return false

      return true
    })
  }, [employees, showInactive, filters, scheduledHoursByEmployeeId])
  const inactiveCount = (employees ?? []).filter((e) => !e.active).length
  const { page, pageCount, setPage, pageItems: pagedEmployees } = usePagination(visibleEmployees, PAGE_SIZE)

  // הגעה ממקום אחר באפליקציה דרך EmployeeHoverCard ("מעבר לפרטי עובדת") — /staff?search=<שם>.
  // מזריקה את השם לשדה חיפוש השם כאן, כדי שהטבלה תסונן ישירות לשורה שלה. מנקה את פרמטר ה-query
  // אחרי שימוש כדי שלא יידרס חיפוש ידני אם המשתמשת פשוט מרעננת/חוזרת לעמוד.
  useEffect(() => {
    const target = searchParams.get('search')
    if (!target) return
    filters.name.setText(target)
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams])

  function openCreateModal() {
    setModal({ kind: 'create' })
    setForm({ ...emptyForm, employee_type_id: employeeTypes?.[0]?.id ?? 0 })
    setFormError(null)
  }

  function openEditModal(employee: EmployeeWithType) {
    setModal({ kind: 'edit', employee })
    setForm({
      full_name: employee.full_name,
      employee_type_id: employee.employee_type_id,
      phone: employee.phone ?? '',
      email: employee.email ?? '',
      status: employee.status,
      is_preferred: employee.is_preferred,
      notes: employee.notes ?? '',
      category_id: employee.category_id,
    })
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!schoolId || !modal) return

    const trimmedName = form.full_name.trim()
    if (!trimmedName) {
      setFormError('יש להזין שם מלא')
      return
    }
    if (!form.employee_type_id) {
      setFormError('יש לבחור תפקיד בסיס')
      return
    }
    if (duplicateNameWarning) {
      setFormError(`כבר קיימת עובדת בשם "${trimmedName}" — לא ניתן להוסיף שם כפול`)
      return
    }

    const payload: EmployeeFormInput = {
      ...form,
      full_name: trimmedName,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      notes: form.notes?.trim() || null,
      is_preferred: form.status === 'substitute' ? form.is_preferred : false,
    }

    try {
      if (modal.kind === 'create') {
        await createEmployee.mutateAsync({ schoolId, ...payload })
      } else {
        await updateEmployee.mutateAsync({
          employeeId: modal.employee.id,
          schoolId,
          ...payload,
        })
      }
      setModal(null)
    } catch {
      setFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  async function handleCancelLeave(leave: LeaveWithEmployee) {
    if (!schoolId) return
    const hasSubDays = (leave.leave_day_assignments ?? []).length > 0
    const message = hasSubDays
      ? 'האם לבטל את החופשה? מ"מ שכבר שובצו כמחליפות יימחקו.'
      : 'האם לבטל את החופשה?'
    if (!(await confirm(message))) return
    cancelLeave.mutate({ schoolId, leaveId: leave.id })
  }

  async function toggleActive(employee: EmployeeWithType) {
    if (!schoolId) return
    const confirmMsg = employee.active
      ? `להשבית את ${employee.full_name}? היא תוסר מרשימות הבחירה, וההיסטוריה שלה תישמר.`
      : `לשחזר את ${employee.full_name}?`
    if (!(await confirm(confirmMsg))) return

    updateEmployee.mutate({ employeeId: employee.id, schoolId, active: !employee.active })
  }

  const isSaving = createEmployee.isPending || updateEmployee.isPending

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">רשימת עובדות</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
            >
              ייבוא מקובץ
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              הוספת עובדת +
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
        {inactiveCount > 0 && (
          <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            הצגת לא-פעילות ({inactiveCount})
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                שם
                <ColumnFilter filter={filters.name} textPlaceholder="חיפוש לפי שם…" />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                תפקיד
                <ColumnFilter filter={filters.role} options={roleOptions} />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                קטגוריה
                <ColumnFilter filter={filters.category} options={categoryOptions} />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                סטטוס
                <ColumnFilter filter={filters.status} options={statusOptions} />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                שעות שבועיות
                <ColumnFilter filter={filters.hours} numeric />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                טלפון
                <ColumnFilter filter={filters.phone} />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                מייל
                <ColumnFilter filter={filters.email} />
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                הערות
                <ColumnFilter filter={filters.notes} />
              </th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
              </tr>
            ) : visibleEmployees.length > 0 ? (
              pagedEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td className={`border-t border-line px-3 py-2 font-medium ${emp.active ? '' : 'opacity-50'}`}>
                    {emp.full_name}
                    {!emp.active && (
                      <span className="mr-1.5 rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[11px] text-[#999]">
                        לא פעילה
                      </span>
                    )}
                  </td>
                  <td className={`border-t border-line px-3 py-2 ${emp.active ? '' : 'opacity-50'}`}>
                    {emp.employee_type?.label ?? '—'}
                  </td>
                  <td className={`border-t border-line px-3 py-2 ${emp.active ? '' : 'opacity-50'}`}>
                    {emp.category ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: emp.category.color }}
                        />
                        {emp.category.name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`border-t border-line px-3 py-2 ${emp.active ? '' : 'opacity-50'}`}>
                    {EMPLOYEE_STATUS_LABELS[emp.status]}
                  </td>
                  <td className={`border-t border-line px-3 py-2 ${emp.active ? '' : 'opacity-50'}`}>
                    {(scheduledHoursByEmployeeId?.get(emp.id) ?? 0) > 0
                      ? formatHours(scheduledHoursByEmployeeId!.get(emp.id)!)
                      : '—'}
                  </td>
                  <td
                    className={`border-t border-line px-3 py-2 text-right ${emp.active ? '' : 'opacity-50'}`}
                    dir="ltr"
                  >
                    {emp.phone ?? '—'}
                  </td>
                  <td
                    className={`border-t border-line px-3 py-2 text-right ${emp.active ? '' : 'opacity-50'}`}
                    dir="ltr"
                  >
                    {emp.email ?? '—'}
                  </td>
                  <td
                    className={`max-w-[200px] truncate border-t border-line px-3 py-2 text-ink-soft ${emp.active ? '' : 'opacity-50'}`}
                    title={emp.notes ?? undefined}
                  >
                    {emp.notes || '—'}
                  </td>
                  <td className="border-t border-line px-3 py-2">
                    {canEdit && (
                      <div className="flex flex-nowrap items-center justify-end gap-1.5 print:hidden">
                        {emp.status === 'permanent' && emp.active && (
                          <button
                            type="button"
                            onClick={() => setLeaveModalEmployee(emp)}
                            title={currentLeaveByEmployeeId.has(emp.id) ? 'ניהול חופשה' : 'הוספת חופשה'}
                            aria-label={currentLeaveByEmployeeId.has(emp.id) ? 'ניהול חופשה' : 'הוספת חופשה'}
                            className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea]"
                          >
                            {currentLeaveByEmployeeId.has(emp.id) ? (
                              <CalendarBadgeIcon badge={Pencil} />
                            ) : (
                              <CalendarPlus size={14} />
                            )}
                          </button>
                        )}
                        {currentLeaveByEmployeeId.has(emp.id) && (
                          <button
                            type="button"
                            onClick={() => handleCancelLeave(currentLeaveByEmployeeId.get(emp.id)!)}
                            title="ביטול חופשה"
                            aria-label="ביטול חופשה"
                            className="rounded-md border border-line p-1.5 text-danger hover:bg-[#f2f0ea]"
                          >
                            <CalendarBadgeIcon badge={Trash2} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(emp)}
                          title="עריכה"
                          aria-label="עריכה"
                          className={`rounded-md border border-line p-1.5 hover:bg-[#f2f0ea] ${emp.active ? '' : 'opacity-50'}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(emp)}
                          title={emp.active ? 'השבתה' : 'שחזור'}
                          aria-label={emp.active ? 'השבתה' : 'שחזור'}
                          className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea]"
                        >
                          {emp.active ? <Trash2 size={14} /> : <RotateCcw size={14} />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-ink-soft">
                  {isFiltered ? 'אין עובדת התואמת את הסינון.' : 'אין עדיין עובדות מוגדרות.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          totalItems={visibleEmployees.length}
          pageSize={PAGE_SIZE}
        />
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">
              {modal.kind === 'create' ? 'הוספת עובדת' : 'עריכת עובדת'}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">שם מלא</span>
                <input
                  autoFocus
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
                {duplicateNameWarning && (
                  <div className="mt-1 text-[12px] text-danger">
                    כבר קיימת עובדת בשם "{form.full_name.trim()}" — לא ניתן להוסיף שם כפול
                  </div>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">תפקיד בסיס</span>
                <select
                  value={form.employee_type_id || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, employee_type_id: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                >
                  <option value="" disabled>
                    בחרי תפקיד…
                  </option>
                  {employeeTypes?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="mb-1 block text-[13px] text-ink-soft">טלפון</span>
                  <input
                    value={form.phone ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    dir="ltr"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                  />
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-[13px] text-ink-soft">מייל</span>
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    dir="ltr"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">קטגוריה (רשות)</span>
                <select
                  value={form.category_id ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category_id: e.target.value ? Number(e.target.value) : null }))
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                >
                  <option value="">ללא קטגוריה</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">סטטוס</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as EmployeeStatus }))
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                >
                  <option value="permanent">קבועה</option>
                  <option value="substitute">מ"מ</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">הערות</span>
                <textarea
                  value={form.notes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              {formError && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
                  {formError}
                </div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSaving || duplicateNameWarning}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isSaving ? 'שמירה...' : 'שמירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {leaveModalEmployee && schoolId && (
        <LeaveFormModal
          schoolId={schoolId}
          employee={leaveModalEmployee}
          existingLeave={currentLeaveByEmployeeId.get(leaveModalEmployee.id)}
          createdBy={profile?.id ?? null}
          onClose={() => setLeaveModalEmployee(null)}
        />
      )}

      {showImportModal && schoolId && (
        <ImportEmployeesModal
          schoolId={schoolId}
          employeeTypes={employeeTypes ?? []}
          existingNames={(employees ?? []).map((e) => e.full_name)}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}
