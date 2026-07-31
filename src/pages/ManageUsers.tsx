import { UsersPanel } from '../components/admin/UsersPanel'

// מסך מצומצם למנהלת בית ספר: רק לשונית "משתמשים", מוגבל לבית הספר שלה (ראו RequireSchoolAdmin
// + admin_list_profiles/school_admin_update_profile/admin-invite-user ב-DB)
export default function ManageUsers() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">ניהול משתמשים</h1>
        <div className="mt-1 text-[13px] text-ink-soft">הוספה וניהול של משתמשות בבית הספר שלך</div>
      </div>

      <UsersPanel scope="school" />
    </div>
  )
}
