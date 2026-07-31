import { useState, type FormEvent } from 'react'
import { useAuth } from '../../lib/AuthContext'
import type { PermissionLevel } from '../../lib/AuthContext'
import { useSchools } from '../../hooks/useSchools'
import {
  useAdminProfiles,
  useInviteUser,
  useUpdateAdminProfile,
  useSchoolAdminUpdateProfile,
  type AdminProfileRow,
} from '../../hooks/useAdminUsers'
import { useConfirm } from '../common/ConfirmProvider'

type Scope = 'system' | 'school'

interface Props {
  scope: Scope
}

const emptyInviteForm = {
  email: '',
  full_name: '',
  school_id: 0,
  permission_level: 'view_only' as PermissionLevel,
}

// לוח ניהול משתמשים — משותף לשתי רמות: 'system' (מנהלת מערכת, לשונית "ניהול מערכת", כל
// בתי הספר) ו-'school' (מנהלת בית ספר, מסך מצומצם, רק בית הספר שלה ולא נוגעת במנהלים
// אחרים — האכיפה בפועל היא בצד השרת, ראו admin_list_profiles/school_admin_update_profile)
export function UsersPanel({ scope }: Props) {
  const { profile: myProfile } = useAuth()
  const { data: profiles, isLoading } = useAdminProfiles()
  const { data: schools } = useSchools()
  const inviteUser = useInviteUser()
  const updateProfileAsSystemAdmin = useUpdateAdminProfile()
  const updateProfileAsSchoolAdmin = useSchoolAdminUpdateProfile()
  const confirm = useConfirm()

  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState(emptyInviteForm)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [detailsUser, setDetailsUser] = useState<AdminProfileRow | null>(null)

  const isUpdating = updateProfileAsSystemAdmin.isPending || updateProfileAsSchoolAdmin.isPending

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
    if (scope === 'system' && !inviteForm.school_id) {
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

  // מנהלת בית ספר לא יכולה לגעת במנהלות מערכת/בית ספר אחרות (אכיפה אמיתית היא ב-DB; זה רק ל-UI)
  const canEdit = (user: AdminProfileRow) => scope === 'system' || (!user.is_system_admin && !user.is_school_admin)

  async function toggleActive(user: AdminProfileRow) {
    const message = user.active
      ? `להשבית את ${user.full_name}? המשתמשת לא תוכל להתחבר יותר למערכת.`
      : `לשחזר את ${user.full_name}?`
    if (!(await confirm(message))) return

    try {
      if (scope === 'system') {
        await updateProfileAsSystemAdmin.mutateAsync({ profileId: user.id, active: !user.active })
      } else {
        await updateProfileAsSchoolAdmin.mutateAsync({
          profileId: user.id,
          permissionLevel: user.permission_level,
          active: !user.active,
        })
      }
      setDetailsUser(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'העדכון נכשל. נסי שוב.')
    }
  }

  async function togglePermissionLevel(user: AdminProfileRow) {
    const next: PermissionLevel = user.permission_level === 'full' ? 'view_only' : 'full'
    const message = `לשנות את הרשאת ${user.full_name} ל${next === 'full' ? 'הרשאה מלאה' : 'צפייה בלבד'}?`
    if (!(await confirm(message))) return

    try {
      if (scope === 'system') {
        await updateProfileAsSystemAdmin.mutateAsync({ profileId: user.id, permission_level: next })
      } else {
        await updateProfileAsSchoolAdmin.mutateAsync({
          profileId: user.id,
          permissionLevel: next,
          active: user.active,
        })
      }
      setDetailsUser(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'העדכון נכשל. נסי שוב.')
    }
  }

  async function toggleSystemAdmin(user: AdminProfileRow) {
    if (user.id === myProfile?.id) return
    const message = user.is_system_admin
      ? `להסיר מ-${user.full_name} הרשאת מנהל מערכת?`
      : `להעניק ל-${user.full_name} הרשאת מנהל מערכת? מנהל מערכת רואה ומנהל את כל בתי הספר.`
    if (!(await confirm(message))) return
    updateProfileAsSystemAdmin.mutate({ profileId: user.id, is_system_admin: !user.is_system_admin })
  }

  async function toggleSchoolAdmin(user: AdminProfileRow) {
    if (user.id === myProfile?.id) return
    const message = user.is_school_admin
      ? `להסיר מ-${user.full_name} הרשאת מנהל בית ספר?`
      : `להעניק ל-${user.full_name} הרשאת מנהל בית ספר? מנהל בית ספר יוכל לגשת ללשונית "משתמשים" בבית הספר שלו בלבד.`
    if (!(await confirm(message))) return
    updateProfileAsSystemAdmin.mutate({ profileId: user.id, is_school_admin: !user.is_school_admin })
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
              {scope === 'system' && (
                <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">בית ספר</th>
              )}
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">הרשאה</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">סטטוס</th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={scope === 'system' ? 6 : 5} className="px-3 py-4 text-center text-ink-soft">
                  טוען…
                </td>
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
                    {user.is_school_admin && (
                      <span className="mr-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                        מנהל בית ספר
                      </span>
                    )}
                  </td>
                  <td className="border-t border-line px-3 py-2 text-right" dir="ltr">{user.email}</td>
                  {scope === 'system' && <td className="border-t border-line px-3 py-2">{user.school_name}</td>}
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
                <td colSpan={scope === 'system' ? 6 : 5} className="px-3 py-4 text-center text-ink-soft">
                  אין עדיין משתמשים.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 text-ink shadow-lg">
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

              {scope === 'system' && (
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
              )}

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
          <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 text-ink shadow-lg">
            <h2 className="mb-4 text-lg font-bold">{detailsUser.full_name}</h2>

            <dl className="mb-4 flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">מייל</dt>
                <dd dir="ltr">{detailsUser.email}</dd>
              </div>
              {scope === 'system' && (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">בית ספר</dt>
                  <dd>{detailsUser.school_name}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">רמת הרשאה</dt>
                <dd>{detailsUser.permission_level === 'full' ? 'הרשאה מלאה' : 'צפייה בלבד'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">סטטוס</dt>
                <dd>{detailsUser.active ? 'פעיל' : 'לא פעיל'}</dd>
              </div>
              {scope === 'system' && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">מנהל מערכת</dt>
                    <dd>{detailsUser.is_system_admin ? 'כן' : 'לא'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">מנהל בית ספר</dt>
                    <dd>{detailsUser.is_school_admin ? 'כן' : 'לא'}</dd>
                  </div>
                </>
              )}
            </dl>

            {!canEdit(detailsUser) ? (
              <div className="mb-2 rounded-lg bg-[#f2f0ea] px-3 py-2 text-[12.5px] text-ink-soft">
                לא ניתן לערוך מנהלת מערכת/בית ספר אחרת ממסך זה.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => togglePermissionLevel(detailsUser)}
                  disabled={isUpdating}
                  className="rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea] disabled:opacity-60"
                >
                  {detailsUser.permission_level === 'full' ? 'העברה לצפייה בלבד' : 'העברה להרשאה מלאה'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(detailsUser)}
                  disabled={isUpdating}
                  className="rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea] disabled:opacity-60"
                >
                  {detailsUser.active ? 'השבתת משתמש' : 'שחזור משתמש'}
                </button>
                {scope === 'system' && detailsUser.id !== myProfile?.id && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleSystemAdmin(detailsUser)}
                      className="rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                    >
                      {detailsUser.is_system_admin ? 'הסרת הרשאת מנהל מערכת' : 'הענקת הרשאת מנהל מערכת'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSchoolAdmin(detailsUser)}
                      className="rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                    >
                      {detailsUser.is_school_admin ? 'הסרת הרשאת מנהל בית ספר' : 'הענקת הרשאת מנהל בית ספר'}
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setDetailsUser(null)}
              className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              סגירה
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
