import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Ban, RotateCcw } from 'lucide-react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import {
  useClassesOverview,
  useCreateClass,
  useUpdateClass,
  type ClassOverviewRow,
} from '../hooks/useClasses'
import { useAuth } from '../lib/AuthContext'
import { useConfirm } from '../components/common/ConfirmProvider'

const STATUS_LABEL: Record<ClassOverviewRow['status'], string> = {
  complete: 'הושלם',
  partial: 'חלקי',
  not_defined: 'טרם הוגדר',
}

const STATUS_CLASS: Record<ClassOverviewRow['status'], string> = {
  complete: 'bg-[#e6f4ea] text-[#1e7b34]',
  partial: 'bg-warn-soft text-warn',
  not_defined: 'bg-[#f2f0ea] text-[#999]',
}

type ModalMode = { kind: 'create' } | { kind: 'edit'; classRow: ClassOverviewRow }

export default function Classes() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const canEdit = profile?.permission_level === 'full'
  const navigate = useNavigate()

  const { data: classes, isLoading } = useClassesOverview(schoolId)
  const createClass = useCreateClass()
  const updateClass = useUpdateClass()
  const confirm = useConfirm()

  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const visibleClasses = useMemo(
    () => (classes ?? []).filter((c) => c.active || showInactive),
    [classes, showInactive],
  )
  const inactiveCount = (classes ?? []).filter((c) => !c.active).length

  function openCreateModal() {
    setModal({ kind: 'create' })
    setName('')
    setFormError(null)
  }

  function openEditModal(classRow: ClassOverviewRow) {
    setModal({ kind: 'edit', classRow })
    setName(classRow.name)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!schoolId || !modal) return

    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('יש להזין שם כיתה')
      return
    }
    const duplicate = classes?.some(
      (c) => c.name === trimmed && (modal.kind === 'create' || c.id !== modal.classRow.id),
    )
    if (duplicate) {
      setFormError('כבר קיימת כיתה בשם זה')
      return
    }

    try {
      if (modal.kind === 'create') {
        await createClass.mutateAsync({ schoolId, name: trimmed })
      } else {
        await updateClass.mutateAsync({ classId: modal.classRow.id, schoolId, name: trimmed })
      }
      setModal(null)
    } catch {
      setFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  async function toggleActive(classRow: ClassOverviewRow) {
    if (!schoolId) return
    const confirmMsg = classRow.active
      ? `להשבית את כיתה ${classRow.name}? היא תוסר מרשימות הבחירה, וההיסטוריה שלה תישמר.`
      : `לשחזר את כיתה ${classRow.name}?`
    if (!(await confirm(confirmMsg))) return

    updateClass.mutate({ classId: classRow.id, schoolId, active: !classRow.active })
  }

  const isSaving = createClass.isPending || updateClass.isPending

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">כיתות</h1>
          <div className="mt-1 text-[13px] text-ink-soft">
            {classes ? `${classes.filter((c) => c.active).length} כיתות מוגדרות` : ''}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 print:hidden"
          >
            + הוספת כיתה
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5 text-[12.5px] text-ink-soft">
        {inactiveCount > 0 && (
          <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] print:hidden">
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
                שם כיתה
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                חורים ריקים (מ"מ)
              </th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                סטטוס שיבוץ בסיסי
              </th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink-soft">
                  טוען…
                </td>
              </tr>
            ) : visibleClasses.length > 0 ? (
              visibleClasses.map((c) => (
                <tr key={c.id} className={c.active ? '' : 'opacity-50'}>
                  <td className="border-t border-line px-3 py-2 font-medium">
                    {c.name}
                    {!c.active && (
                      <span className="mr-1.5 rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[11px] text-[#999]">
                        לא פעילה
                      </span>
                    )}
                  </td>
                  <td className="border-t border-line px-3 py-2">{c.totalSlots}</td>
                  <td className="border-t border-line px-3 py-2">{c.emptySlots}</td>
                  <td className="border-t border-line px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLASS[c.status]}`}
                    >
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="border-t border-line px-3 py-2">
                    <div className="flex justify-end gap-1.5 print:hidden">
                      {c.active && (
                        <button
                          type="button"
                          onClick={() => navigate('/base', { state: { classId: c.id } })}
                          className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                        >
                         מעבר לשיבוץ
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            title="עריכה"
                            aria-label="עריכה"
                            className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea]"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(c)}
                            title={c.active ? 'השבתה' : 'שחזור'}
                            aria-label={c.active ? 'השבתה' : 'שחזור'}
                            className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea]"
                          >
                            {c.active ? <Ban size={14} /> : <RotateCcw size={14} />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink-soft">
                  אין עדיין כיתות מוגדרות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[360px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">
              {modal.kind === 'create' ? 'הוספת כיתה' : 'עריכת שם כיתה'}
            </h2>
            <form onSubmit={handleSubmit}>
              <label className="mb-3 block">
                <span className="mb-1 block text-[13px] text-ink-soft">שם כיתה</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='לדוגמה: א׳3'
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              {modal.kind === 'create' && (
                <div className="mb-4 rounded-lg bg-[#f2f0ea] px-3 py-2 text-[12px] text-ink-soft">
                  תיווצר לכיתה תבנית שיבוץ בסיסית ריקה: מורה + 2 סייעות, בוקר וצהריים, לכל ימי
                  השבוע. ניתן לערוך כל חור לאחר היצירה.
                </div>
              )}

              {formError && (
                <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
                  {formError}
                </div>
              )}

              <div className="flex gap-2">
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
                  {isSaving ? 'שמירה...' : modal.kind === 'create' ? 'הוספת כיתה' : 'שמירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
