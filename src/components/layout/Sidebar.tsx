import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

// כל פריט תפריט תואם למסך אחד מהאפיון (סעיף 5) ומהמוקאפ (data-screen)
const NAV_ITEMS = [
  { to: '/', label: 'דאשבורד', end: true },
  { to: '/base', label: 'שיבוץ צוות קבוע בכיתות'},
  { to: '/missing', label: 'שיבוץ מ"מ' },
  { to: '/employee', label: 'דוח לעובדת' },
  { to: '/leave', label: 'ניהול חופשות' },
  { to: '/draft', label: 'טיוטת שיבוץ' },
  { to: '/opening', label: 'מערכת פתיחות' },
] as const

// קבוצת "ניהול" — הגדרות מערכת + מסכי בסיס (כיתות/עובדות) שמשמשים להקמה/תחזוקה, לא לעבודה היומיומית
const MANAGEMENT_ITEMS = [
  { to: '/management', label: 'הגדרות' },
  { to: '/staff', label: 'רשימת עובדות' },
  { to: '/classes', label: 'כיתות' },
] as const

export function Sidebar() {
  const { profile, signOut } = useAuth()

  return (
    <aside className="flex w-[220px] shrink-0 flex-col gap-1 bg-ink px-4 py-[22px] text-[#e9e7e0]">
      <div className="mb-[22px] text-[15px] font-bold tracking-[.3px] text-white">
        מערך צוות
        <span className="mt-0.5 block text-[11px] font-normal text-[#9aa0a8]">
          מערכת שיבוץ בית-ספרית
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            className={({ isActive }) =>
              [
                'rounded-lg px-3 py-2.5 text-[13.5px] transition-colors',
                isActive
                  ? 'bg-accent font-semibold text-white'
                  : 'text-[#c7cad0] hover:bg-[#2a3340] hover:text-white',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}

        <div className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
          ניהול
        </div>
        {MANAGEMENT_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'rounded-lg px-3 py-2.5 text-[13.5px] transition-colors',
                isActive
                  ? 'bg-accent font-semibold text-white'
                  : 'text-[#c7cad0] hover:bg-[#2a3340] hover:text-white',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 border-t border-[#2a3340] pt-3">
        {profile && (
          <div className="mb-2 px-1">
            <div className="truncate text-[13px] font-medium text-white">{profile.full_name}</div>
            <div className="text-[11px] text-[#9aa0a8]">
              {profile.permission_level === 'full' ? 'הרשאה מלאה' : 'צפייה בלבד'}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={signOut}
          className="w-full rounded-lg px-3 py-2 text-right text-[13px] text-[#c7cad0] transition-colors hover:bg-[#2a3340] hover:text-white"
        >
          התנתקות
        </button>
      </div>
    </aside>
  )
}
