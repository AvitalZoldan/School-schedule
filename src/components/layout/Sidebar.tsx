import { NavLink } from 'react-router-dom'

// כל פריט תפריט תואם למסך אחד מהאפיון (סעיף 5) ומהמוקאפ (data-screen)
const NAV_ITEMS = [
  { to: '/', label: 'לוח בקרה', end: true },
  { to: '/base', label: 'שיבוץ בסיסי' },
  { to: '/daily', label: 'שיבוץ יומי — מ"מ' },
  { to: '/missing', label: 'דוח חסרים' },
  { to: '/employee', label: 'דוח עובדת' },
  { to: '/leave', label: 'חופשות' },
  { to: '/draft', label: 'טיוטת שיבוץ' },
  { to: '/opening', label: 'מערכת פתיחות' },
  { to: '/substitutes', label: 'רשימת מ"מ' },
] as const

export function Sidebar() {
  return (
    <aside className="w-[220px] shrink-0 bg-ink text-[#e9e7e0] flex flex-col gap-1 px-4 py-[22px]">
      <div className="mb-[22px] text-[15px] font-bold tracking-[.3px] text-white">
        מערך צוות
        <span className="mt-0.5 block text-[11px] font-normal text-[#9aa0a8]">
          מערכת שיבוץ בית-ספרית
        </span>
      </div>

      <nav className="flex flex-col gap-1">
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
      </nav>
    </aside>
  )
}
