import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useEmployeesOverview } from '../hooks/useEmployees'
import { WEEKDAY_LABELS } from '../types/schedule'
import type { StaffSourceMode } from '../types/auxiliary'
import {
  useAuxiliarySystems,
  useAuxiliarySystemsOverview,
  useCreateAuxiliarySystem,
  useUpdateAuxiliarySystem,
  useAuxiliaryRoster,
  useStaffByWeekday,
  useCreateAuxiliaryRole,
} from '../hooks/useAuxiliarySystems'
import { AuxiliaryCell } from '../components/auxiliary/AuxiliaryCell'
import { useAuth } from '../lib/AuthContext'
import { useConfirm } from '../components/common/ConfirmProvider'
import { SegmentedToggle } from '../components/common/SegmentedToggle'

const WEEKDAYS = [1, 2, 3, 4, 5, 6]

const STAFF_SOURCE_LABELS: Record<StaffSourceMode, string> = {
  morning: 'צוות המשובץ בבוקר',
  afternoon: 'צוות המשובץ בצהריים',
  all: 'כל העובדות',
}

export default function AuxiliarySystems() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const canEdit = profile?.permission_level === 'full'
  const confirm = useConfirm()

  const { data: systems, isLoading: systemsLoading } = useAuxiliarySystems(schoolId)
  const { data: systemsOverview } = useAuxiliarySystemsOverview(schoolId)
  const { data: allEmployees } = useEmployeesOverview(schoolId)
  const createSystem = useCreateAuxiliarySystem()
  const updateSystem = useUpdateAuxiliarySystem()

  // לפתרון שם התצוגה של עובדת משובצת גם אם היא לא (יותר) ברשימת המועמדות המוגבלת
  // (availableEmployees) — למשל שינוי במקור הצוות של המערכת, או שהיא כבר לא מתוזמנת אז בשיבוץ
  // הבסיסי. בלי זה, תא מאויש בפועל (employee_id קיים) היה מוצג בטעות כ"לא מאויש" עם צבע "מאויש".
  const employeesById = useMemo(() => new Map((allEmployees ?? []).map((e) => [e.id, e])), [allEmployees])

  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null)
  useEffect(() => {
    if (selectedSystemId === null && systems && systems.length > 0) {
      setSelectedSystemId(systems[0].id)
    }
  }, [systems, selectedSystemId])

  const selectedSystem = systems?.find((s) => s.id === selectedSystemId)

  const { data: roster, isLoading: rosterLoading } = useAuxiliaryRoster(schoolId, selectedSystemId ?? undefined)
  const { data: staffByWeekday } = useStaffByWeekday(schoolId, selectedSystem?.source_day_part)
  const createRole = useCreateAuxiliaryRole()

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [roleFormError, setRoleFormError] = useState<string | null>(null)

  const [systemModalOpen, setSystemModalOpen] = useState(false)
  const [newSystemName, setNewSystemName] = useState('')
  const [newSystemDayPart, setNewSystemDayPart] = useState<StaffSourceMode>('morning')
  const [newSystemShowInMissing, setNewSystemShowInMissing] = useState(true)
  const [systemFormError, setSystemFormError] = useState<string | null>(null)

  function openRoleModal() {
    setNewRoleName('')
    setRoleFormError(null)
    setRoleModalOpen(true)
  }

  async function handleRoleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!schoolId || !selectedSystemId) return

    const trimmed = newRoleName.trim()
    if (!trimmed) {
      setRoleFormError('יש להזין שם תפקיד')
      return
    }

    try {
      await createRole.mutateAsync({
        schoolId,
        systemId: selectedSystemId,
        name: trimmed,
        sortOrder: (roster?.length ?? 0) + 1,
      })
      setRoleModalOpen(false)
    } catch {
      setRoleFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  function openSystemModal() {
    setNewSystemName('')
    setNewSystemDayPart('morning')
    setNewSystemShowInMissing(true)
    setSystemFormError(null)
    setSystemModalOpen(true)
  }

  async function handleSystemSubmit(e: FormEvent) {
    e.preventDefault()
    if (!schoolId) return

    const trimmed = newSystemName.trim()
    if (!trimmed) {
      setSystemFormError('יש להזין שם מערכת')
      return
    }

    try {
      const created = await createSystem.mutateAsync({
        schoolId,
        name: trimmed,
        sourceDayPart: newSystemDayPart,
        showInMissing: newSystemShowInMissing,
        sortOrder: (systemsOverview?.length ?? 0) + 1,
      })
      setSystemModalOpen(false)
      setSelectedSystemId(created.id)
    } catch {
      setSystemFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  async function deactivateSystem() {
    if (!schoolId || !selectedSystem) return
    const message = `להשבית את "${selectedSystem.name}"? התפקידים והשיבוצים שלה יישמרו, אבל היא לא תוצג יותר בדשבורד/שיבוץ מ"מ.`
    if (!(await confirm(message))) return
    await updateSystem.mutateAsync({ systemId: selectedSystem.id, schoolId, active: false })
    setSelectedSystemId(null)
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">מערכות עזר</h1>
          <div className="mt-1 text-[13px] text-ink-soft">
            טבלה שבועית קבועה לכל מערכת — תפקיד × יום בשבוע, פעם אחת ביום (למשל פתיחות/סגירות)
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openSystemModal}
            className="shrink-0 rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-semibold hover:bg-[#f2f0ea] print:hidden"
          >
            + מערכת חדשה
          </button>
        )}
      </div>

      {systemsLoading ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
      ) : !systems || systems.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-center text-ink-soft">
          אין עדיין מערכות עזר מוגדרות. {canEdit && 'לחצי על "+ מערכת חדשה" כדי להתחיל.'}
        </div>
      ) : (
        <>
          <div className="mb-4 print:hidden">
            <SegmentedToggle
              value={String(selectedSystemId)}
              onChange={(value) => setSelectedSystemId(Number(value))}
              options={systems.map((s) => ({ value: String(s.id), label: s.name }))}
            />
          </div>

          {selectedSystem && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel p-3 text-[12.5px] text-ink-soft print:hidden">
              <div className="flex flex-wrap items-center gap-1.5">
                <span>מקור צוות המועמדות:</span>
                {canEdit ? (
                  <select
                    value={selectedSystem.source_day_part}
                    onChange={(e) =>
                      updateSystem.mutate({
                        systemId: selectedSystem.id,
                        schoolId: schoolId!,
                        sourceDayPart: e.target.value as StaffSourceMode,
                      })
                    }
                    className="rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-ink"
                  >
                    <option value="morning">{STAFF_SOURCE_LABELS.morning}</option>
                    <option value="afternoon">{STAFF_SOURCE_LABELS.afternoon}</option>
                    <option value="all">{STAFF_SOURCE_LABELS.all}</option>
                  </select>
                ) : (
                  <span className="font-medium text-ink">{STAFF_SOURCE_LABELS[selectedSystem.source_day_part]}</span>
                )}
                {' · '}
                הצגה בחוסרים (דשבורד/שיבוץ מ"מ):{' '}
                <span className="font-medium text-ink">{selectedSystem.show_in_missing ? 'כן' : 'לא'}</span>
              </div>
              {canEdit && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateSystem.mutate({
                        systemId: selectedSystem.id,
                        schoolId: schoolId!,
                        showInMissing: !selectedSystem.show_in_missing,
                      })
                    }
                    className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                  >
                    {selectedSystem.show_in_missing ? 'הפסקת הצגה בחוסרים' : 'הצגה בחוסרים'}
                  </button>
                  <button
                    type="button"
                    onClick={deactivateSystem}
                    className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] text-danger hover:bg-[#f2f0ea]"
                  >
                    השבתת המערכת
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-line bg-panel">
            {canEdit && (
              <div className="flex justify-end border-b border-line p-2 print:hidden">
                <button
                  type="button"
                  onClick={openRoleModal}
                  className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  + הוספת תפקיד
                </button>
              </div>
            )}

            {/* table-fixed: העמודות מתחלקות ברוחב הזמין ולא גולשות — בלי גלילה אופקית.
                תוכן ארוך (שם/הערה) עובר שורה במקום לגלוש. */}
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
                {rosterLoading ? (
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
                        schoolId && selectedSystem ? (
                          <AuxiliaryCell
                            key={wd}
                            schoolId={schoolId}
                            systemName={selectedSystem.name}
                            roleId={role.id}
                            weekday={wd}
                            assignment={role.assignments[wd]}
                            availableEmployees={staffByWeekday?.[wd] ?? []}
                            employeesById={employeesById}
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
                      אין עדיין תפקידים מוגדרים במערכת זו.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-line px-3 py-2.5 text-[12px] text-ink-soft">
              {selectedSystem?.source_day_part === 'all'
                ? 'רשימת הבחירה כוללת את כל העובדות הפעילות של בית הספר, בכל יום.'
                : `רשימת הבחירה בכל יום מוגבלת לעובדות המשובצות לחור ${
                    selectedSystem?.source_day_part === 'afternoon' ? 'צהריים' : 'בוקר'
                  } כלשהו, בכיתה כלשהי, ביום זה (מהשיבוץ הבסיסי הפעיל).`}{' '}
              תא לא-מאויש מודגש באדום.
            </div>
          </div>
        </>
      )}

      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[360px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">הוספת תפקיד ל{selectedSystem?.name ?? ''}</h2>
            <form onSubmit={handleRoleSubmit}>
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

              {roleFormError && (
                <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
                  {roleFormError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
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

      {systemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[380px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">מערכת עזר חדשה</h2>
            <form onSubmit={handleSystemSubmit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">שם המערכת</span>
                <input
                  autoFocus
                  value={newSystemName}
                  onChange={(e) => setNewSystemName(e.target.value)}
                  placeholder="לדוגמה: מערכת סגירות"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">מקור צוות המועמדות</span>
                <select
                  value={newSystemDayPart}
                  onChange={(e) => setNewSystemDayPart(e.target.value as StaffSourceMode)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                >
                  <option value="morning">{STAFF_SOURCE_LABELS.morning}</option>
                  <option value="afternoon">{STAFF_SOURCE_LABELS.afternoon}</option>
                  <option value="all">{STAFF_SOURCE_LABELS.all}</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={newSystemShowInMissing}
                  onChange={(e) => setNewSystemShowInMissing(e.target.checked)}
                />
                הצגת חורים של מערכת זו בדשבורד ובשיבוץ מ"מ
              </label>

              {systemFormError && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{systemFormError}</div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSystemModalOpen(false)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={createSystem.isPending}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {createSystem.isPending ? 'שומרת…' : 'יצירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
