import { useEffect, useState, type FormEvent } from 'react'
import { useSchools, useCreateSchool, useUpdateSchool } from '../hooks/useSchools'
import { useSystemSettings, useUpdateSystemSettings } from '../hooks/useSystemSettings'
import type { SchoolRow } from '../types/schedule'
import { useConfirm } from '../components/common/ConfirmProvider'
import { UsersPanel } from '../components/admin/UsersPanel'

type Tab = 'schools' | 'users' | 'settings'

export default function SystemAdmin() {
  const [tab, setTab] = useState<Tab>('schools')

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">ניהול מערכת</h1>
        <div className="mt-1 text-[13px] text-ink-soft">
          הוספת בתי ספר וניהול משתמשים בכל המערכת — מנהלי מערכת בלבד
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-line print:hidden">
        <button
          type="button"
          onClick={() => setTab('schools')}
          className={[
            'px-3 py-2 text-[13.5px] font-medium',
            tab === 'schools'
              ? 'border-b-2 border-accent text-accent'
              : 'text-ink-soft hover:text-ink',
          ].join(' ')}
        >
          בתי ספר
        </button>
        <button
          type="button"
          onClick={() => setTab('users')}
          className={[
            'px-3 py-2 text-[13.5px] font-medium',
            tab === 'users' ? 'border-b-2 border-accent text-accent' : 'text-ink-soft hover:text-ink',
          ].join(' ')}
        >
          משתמשים
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={[
            'px-3 py-2 text-[13.5px] font-medium',
            tab === 'settings' ? 'border-b-2 border-accent text-accent' : 'text-ink-soft hover:text-ink',
          ].join(' ')}
        >
          הגדרות
        </button>
      </div>

      {tab === 'schools' ? <SchoolsPanel /> : tab === 'users' ? <UsersPanel scope="system" /> : <SettingsPanel />}
    </div>
  )
}

function SettingsPanel() {
  const { data: settings, isLoading } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()
  const [idleTimeout, setIdleTimeout] = useState(15)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) setIdleTimeout(settings.idle_timeout_minutes)
  }, [settings])

  async function handleSave() {
    setSaved(false)
    await updateSettings.mutateAsync({ idleTimeoutMinutes: idleTimeout })
    setSaved(true)
  }

  if (isLoading) return <div className="text-ink-soft">טוען…</div>

  return (
    <div className="max-w-[420px] rounded-xl border border-line bg-panel p-5">
      <label className="block">
        <span className="mb-1 block text-[13px] font-medium">ניתוק אוטומטי לאחר חוסר פעילות (בדקות)</span>
        <span className="mb-2 block text-[12px] text-ink-soft">
          משתמשות ינותקו אוטומטית מהמערכת לאחר שהות ללא כל פעילות למשך פרק הזמן הזה.
        </span>
        <input
          type="number"
          min={1}
          value={idleTimeout}
          onChange={(e) => {
            setSaved(false)
            setIdleTimeout(Number(e.target.value))
          }}
          className="w-32 rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
        />
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateSettings.isPending || idleTimeout <= 0}
          className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {updateSettings.isPending ? 'שומרת…' : 'שמירה'}
        </button>
        {saved && <span className="text-[12.5px] text-accent">נשמר</span>}
      </div>
    </div>
  )
}

function SchoolsPanel() {
  const { data: schools, isLoading } = useSchools()
  const createSchool = useCreateSchool()
  const updateSchool = useUpdateSchool()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [limitSchool, setLimitSchool] = useState<SchoolRow | null>(null)
  const [limitValue, setLimitValue] = useState(5)
  const [limitError, setLimitError] = useState<string | null>(null)

  function openModal() {
    setName('')
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('יש להזין שם בית ספר')
      return
    }
    try {
      await createSchool.mutateAsync(trimmed)
      setModalOpen(false)
    } catch {
      setFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  async function toggleActive(school: SchoolRow) {
    const message = school.active
      ? `להשבית את "${school.name}"? המשתמשים ששייכים לבית הספר יישארו, אך בית הספר יסומן כלא-פעיל.`
      : `לשחזר את "${school.name}"?`
    if (!(await confirm(message))) return
    updateSchool.mutate({ schoolId: school.id, active: !school.active })
  }

  function openLimitModal(school: SchoolRow) {
    setLimitSchool(school)
    setLimitValue(school.max_full_access_users)
    setLimitError(null)
  }

  async function handleLimitSubmit(e: FormEvent) {
    e.preventDefault()
    if (!limitSchool || limitValue <= 0) {
      setLimitError('יש להזין מספר גדול מ-0')
      return
    }
    try {
      await updateSchool.mutateAsync({ schoolId: limitSchool.id, max_full_access_users: limitValue })
      setLimitSchool(null)
    } catch {
      setLimitError('השמירה נכשלה. נסי שוב.')
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end print:hidden">
        <button
          type="button"
          onClick={openModal}
          className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          + בית ספר חדש
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">שם בית הספר</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">סטטוס</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
                מקס' משתמשות עם הרשאת עריכה
              </th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
              </tr>
            ) : schools && schools.length > 0 ? (
              schools.map((school) => (
                <tr key={school.id} className={school.active ? '' : 'opacity-50'}>
                  <td className="border-t border-line px-3 py-2 font-medium">{school.name}</td>
                  <td className="border-t border-line px-3 py-2">
                    {school.active ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                        פעיל
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[11px] text-[#999]">
                        לא פעיל
                      </span>
                    )}
                  </td>
                  <td className="border-t border-line px-3 py-2 text-center">{school.max_full_access_users}</td>
                  <td className="border-t border-line px-3 py-2">
                    <div className="flex justify-end gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => openLimitModal(school)}
                        className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                      >
                        עריכת מגבלה
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(school)}
                        className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                      >
                        {school.active ? 'השבתה' : 'שחזור'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-ink-soft">אין עדיין בתי ספר מוגדרים.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[380px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">בית ספר חדש</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">שם בית הספר</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              {formError && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{formError}</div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={createSchool.isPending}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {createSchool.isPending ? 'שומרת…' : 'שמירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {limitSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[380px] rounded-xl border border-line bg-panel p-6 text-ink shadow-lg">
            <h2 className="mb-4 text-lg font-bold">מגבלת עריכה — {limitSchool.name}</h2>
            <form onSubmit={handleLimitSubmit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">
                  מספר מקסימלי של משתמשות עם הרשאת עריכה (צפייה בלבד ללא הגבלה)
                </span>
                <input
                  autoFocus
                  type="number"
                  min={1}
                  value={limitValue}
                  onChange={(e) => setLimitValue(Number(e.target.value))}
                  className="w-32 rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              {limitError && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{limitError}</div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setLimitSchool(null)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={updateSchool.isPending}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {updateSchool.isPending ? 'שומרת…' : 'שמירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
