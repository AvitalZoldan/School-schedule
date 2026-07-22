import { useMemo, useState, type FormEvent } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import {
  useEmployeesOverview,
  useEmployeeTypes,
  useCreateEmployee,
  useUpdateEmployee,
  type EmployeeWithType,
  type EmployeeFormInput,
} from '../hooks/useEmployees'
import { EMPLOYEE_STATUS_LABELS, type EmployeeStatus } from '../types/schedule'
import { useAuth } from '../lib/AuthContext'

type ModalMode = { kind: 'create' } | { kind: 'edit'; employee: EmployeeWithType }

const emptyForm: EmployeeFormInput = {
  full_name: '',
  employee_type_id: 0,
  phone: '',
  email: '',
  status: 'permanent',
  is_preferred: false,
  notes: '',
}

export default function Employees() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const canEdit = profile?.permission_level === 'full'

  const { data: employees, isLoading } = useEmployeesOverview(schoolId)
  const { data: employeeTypes } = useEmployeeTypes(schoolId)
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()

  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [form, setForm] = useState<EmployeeFormInput>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)

  const visibleEmployees = useMemo(
    () => (employees ?? []).filter((e) => e.active || showInactive),
    [employees, showInactive],
  )
  const inactiveCount = (employees ?? []).filter((e) => !e.active).length

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

  function toggleActive(employee: EmployeeWithType) {
    if (!schoolId) return
    const confirmMsg = employee.active
      ? `להשבית את ${employee.full_name}? היא תוסר מרשימות הבחירה, וההיסטוריה שלה תישמר.`
      : `לשחזר את ${employee.full_name}?`
    if (!window.confirm(confirmMsg)) return

    updateEmployee.mutate({ employeeId: employee.id, schoolId, active: !employee.active })
  }

  const isSaving = createEmployee.isPending || updateEmployee.isPending

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">רשימת עובדות</h1>
          <div className="mt-1 text-[13px] text-ink-soft">
            כלל העובדות הקבועות והמ"מ — שם, טלפון, מייל, תפקיד
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            + עובדת חדשה
          </button>
        )}
      </div>

      {inactiveCount > 0 && (
        <div className="mb-4 flex justify-end">
          <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            הצגת לא-פעילות ({inactiveCount})
          </label>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">שם</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">תפקיד</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">סטטוס</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">טלפון</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">מייל</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">מועדפת</th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
              </tr>
            ) : visibleEmployees.length > 0 ? (
              visibleEmployees.map((emp) => (
                <tr key={emp.id} className={emp.active ? '' : 'opacity-50'}>
                  <td className="border-t border-line px-3 py-2 font-medium">
                    {emp.full_name}
                    {!emp.active && (
                      <span className="mr-1.5 rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[11px] text-[#999]">
                        לא פעילה
                      </span>
                    )}
                  </td>
                  <td className="border-t border-line px-3 py-2">{emp.employee_type?.label ?? '—'}</td>
                  <td className="border-t border-line px-3 py-2">
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                      {EMPLOYEE_STATUS_LABELS[emp.status]}
                    </span>
                  </td>
                  <td className="border-t border-line px-3 py-2" dir="ltr">{emp.phone ?? '—'}</td>
                  <td className="border-t border-line px-3 py-2" dir="ltr">{emp.email ?? '—'}</td>
                  <td className="border-t border-line px-3 py-2">
                    {emp.status === 'substitute' ? (emp.is_preferred ? '⭐ כן' : 'לא') : '—'}
                  </td>
                  <td className="border-t border-line px-3 py-2">
                    {canEdit && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(emp)}
                          className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                        >
                          עריכה
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(emp)}
                          className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                        >
                          {emp.active ? 'השבתה' : 'שחזור'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-ink-soft">
                  אין עדיין עובדות מוגדרות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-2.5 text-[12px] text-ink-soft">
          מ"מ המסומנות ⭐ מועדפת מוצגות ראשונות ברשימת הבחירה במסך הדאשבורד. הסרת עובדת מסתירה
          אותה מרשימות הבחירה בלבד — היסטוריית השיבוצים שלה נשמרת.
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">
              {modal.kind === 'create' ? 'עובדת חדשה' : 'עריכת עובדת'}
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

              {form.status === 'substitute' && (
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={form.is_preferred}
                    onChange={(e) => setForm((f) => ({ ...f, is_preferred: e.target.checked }))}
                  />
                  מ"מ מועדפת (מוצגת ראשונה ברשימת הבחירה)
                </label>
              )}

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
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isSaving ? 'שומרת…' : 'שמירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
