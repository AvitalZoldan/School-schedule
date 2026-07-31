import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'
import type { PermissionLevel } from '../lib/AuthContext'
import { useSchools, useCreateSchool, useUpdateSchool } from '../hooks/useSchools'
import {
  useAdminProfiles,
  useInviteUser,
  useUpdateAdminProfile,
  type AdminProfileRow,
} from '../hooks/useAdminUsers'
import { useSystemSettings, useUpdateSystemSettings } from '../hooks/useSystemSettings'
import type { SchoolRow } from '../types/schedule'
import { useConfirm } from '../components/common/ConfirmProvider'

type Tab = 'schools' | 'users' | 'settings'

const emptyInviteForm = {
  email: '',
  full_name: '',
  school_id: 0,
  permission_level: 'view_only' as PermissionLevel,
}

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

      {tab === 'schools' ? <SchoolsPanel /> : tab === 'users' ? <UsersPanel /> : <SettingsPanel />}
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
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
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
                  <td className="border-t border-line px-3 py-2">
                    <div className="flex justify-end print:hidden">
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
                <td colSpan={3} className="px-3 py-4 text-center text-ink-soft">אין עדיין בתי ספר מוגדרים.</td>
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
    </div>
  )
}

function UsersPanel() {
  const { profile: myProfile } = useAuth()
  const { data: profiles, isLoading } = useAdminProfiles()
  const { data: schools } = useSchools()
  const inviteUser = useInviteUser()
  const updateProfile = useUpdateAdminProfile()
  const confirm = useConfirm()

  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState(emptyInviteForm)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [detailsUser, setDetailsUser] = useState<AdminProfileRow | null>(null)

  function openInviteModal() {
    setInviteForm({ ...emptyInviteForm, school_id: schools?.[0]?.id ?? 0 })
    setInviteError(null)
    setInviteModalOpen(true)
  }

  async function handleInviteSubmit(e: FormEvent) {
    e.preventDefault()
    const email = inviteForm.email.trim()
    const fullName = inviteForm.full_name.trim()
    if (!email) {
      setInviteError('יש להזין כתובת מייל')
      return
    }
    if (!fullName) {
      setInviteError('יש להזין שם מלא')
      return
    }
    if (!inviteForm.school_id) {
      setInviteError('יש לבחור בית ספר')
      return
    }

    try {
      await inviteUser.mutateAsync({
        email,
        full_name: fullName,
        school_id: inviteForm.school_id,
        permission_level: inviteForm.permission_level,
      })
      setInviteModalOpen(false)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'שליחת ההזמנה נכשלה. נסי שוב.')
    }
  }

  async function toggleActive(user: AdminProfileRow) {
    const message = user.active
      ? `להשבית את ${user.full_name}? המשתמשת לא תוכל להתחבר יותר למערכת.`
      : `לשחזר את ${user.full_name}?`
    if (!(await confirm(message))) return
    updateProfile.mutate({ profileId: user.id, active: !user.active })
    setDetailsUser(null)
  }

  async function toggleSystemAdmin(user: AdminProfileRow) {
    if (user.id === myProfile?.id) return
    const message = user.is_system_admin
      ? `להסיר מ-${user.full_name} הרשאת מנהל מערכת?`
      : `להעניק ל-${user.full_name} הרשאת מנהל מערכת? מנהל מערכת רואה ומנהל את כל בתי הספר.`
    if (!(await confirm(message))) return
    updateProfile.mutate({ profileId: user.id, is_system_admin: !user.is_system_admin })
  }

  return (
    <div>
      <div className="mb-4 flex justify-end print:hidden">
        <button
          type="button"
          onClick={openInviteModal}
          className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          + הזמנת משתמש
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">שם</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">מייל</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">בית ספר</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">הרשאה</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">סטטוס</th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink-soft">טוען…</td>
              </tr>
            ) : profiles && profiles.length > 0 ? (
              profiles.map((user) => (
                <tr key={user.id} className={user.active ? '' : 'opacity-50'}>
                  <td className="border-t border-line px-3 py-2 font-medium">
                    {user.full_name}
                    {user.is_system_admin && (
                      <span className="mr-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                        מנהל מערכת
                      </span>
                    )}
                  </td>
                  <td className="border-t border-line px-3 py-2 text-right" dir="ltr">{user.email}</td>
                  <td className="border-t border-line px-3 py-2">{user.school_name}</td>
                  <td className="border-t border-line px-3 py-2">
                    {user.permission_level === 'full' ? 'הרשאה מלאה' : 'צפייה בלבד'}
                  </td>
                  <td className="border-t border-line px-3 py-2">
                    {user.active ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">פעיל</span>
                    ) : (
                      <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[11px] text-[#999]">לא פעיל</span>
                    )}
                  </td>
                  <td className="border-t border-line px-3 py-2">
                    <div className="flex justify-end print:hidden">
                      <button
                        type="button"
                        onClick={() => setDetailsUser(user)}
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
                <td colSpan={6} className="px-3 py-4 text-center text-ink-soft">אין עדיין משתמשים.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">הזמנת משתמש חדש</h2>
            <form onSubmit={handleInviteSubmit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">כתובת מייל</span>
                <input
                  autoFocus
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  dir="ltr"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">שם מלא</span>
                <input
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">בית ספר</span>
                <select
                  value={inviteForm.school_id || ''}
                  onChange={(e) => setInviteForm((f) => ({ ...f, school_id: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                >
                  <option value="" disabled>
                    בחרי בית ספר…
                  </option>
                  {schools?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">רמת הרשאה</span>
                <select
                  value={inviteForm.permission_level}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, permission_level: e.target.value as PermissionLevel }))
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                >
                  <option value="full">הרשאה מלאה</option>
                  <option value="view_only">צפייה בלבד</option>
                </select>
              </label>

              {inviteError && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{inviteError}</div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={inviteUser.isPending}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {inviteUser.isPending ? 'שולחת…' : 'שליחת הזמנה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">{detailsUser.full_name}</h2>

            <dl className="mb-4 flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">מייל</dt>
                <dd dir="ltr">{detailsUser.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">בית ספר</dt>
                <dd>{detailsUser.school_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">רמת הרשאה</dt>
                <dd>{detailsUser.permission_level === 'full' ? 'הרשאה מלאה' : 'צפייה בלבד'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">סטטוס</dt>
                <dd>{detailsUser.active ? 'פעיל' : 'לא פעיל'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">מנהל מערכת</dt>
                <dd>{detailsUser.is_system_admin ? 'כן' : 'לא'}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => toggleActive(detailsUser)}
                className="rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
              >
                {detailsUser.active ? 'השבתת משתמש' : 'שחזור משתמש'}
              </button>
              {detailsUser.id !== myProfile?.id && (
                <button
                  type="button"
                  onClick={() => toggleSystemAdmin(detailsUser)}
                  className="rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  {detailsUser.is_system_admin ? 'הסרת הרשאת מנהל מערכת' : 'הענקת הרשאת מנהל מערכת'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailsUser(null)}
                className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                סגירה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
