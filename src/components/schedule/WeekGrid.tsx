import type { TemplateSlotWithEmployee } from '../../types/schedule'
import { DAY_PART_LABELS, WEEKDAY_LABELS } from '../../types/schedule'
import type { EmployeeWithType } from '../../hooks/useEmployees'
import { SlotCell } from './SlotCell'

interface Props {
  slots: TemplateSlotWithEmployee[]
  employees: EmployeeWithType[]
  templateId: number
}

// מפתח שורה = צירוף (role, day_part) — כל צירוף כזה הוא שורה אחת בטבלה,
// עם תא לכל יום שבוע שיש בו slot תואם.
function rowKey(role: string, dayPart: string) {
  return `${dayPart}::${role}`
}

// יום שישי כולל תמיד בוקר בלבד — מזהים את מספר היום לפי התווית, כדי לא להניח מספר קבוע.
const FRIDAY_WEEKDAY = Object.entries(WEEKDAY_LABELS).find(([, label]) => label === 'שישי')?.[0]
const FRIDAY_WD = FRIDAY_WEEKDAY !== undefined ? Number(FRIDAY_WEEKDAY) : undefined

export function WeekGrid({ slots, employees, templateId }: Props) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">
        לא נמצאו חורים בתבנית זו. יש להגדיר תבנית שיבוץ בסיסית לכיתה זו.
      </div>
    )
  }

  const weekdays = [...new Set(slots.map((s) => s.weekday))].sort((a, b) => a - b)

  // שורות: לפי סדר הופעה, כשבוקר קודם לצהריים בכל צירוף role
  const rowOrder: string[] = []
  const rowMeta = new Map<string, { role: string; dayPart: TemplateSlotWithEmployee['day_part'] }>()
  for (const part of ['morning', 'afternoon'] as const) {
    const rolesForPart = [...new Set(slots.filter((s) => s.day_part === part).map((s) => s.role))]
    for (const role of rolesForPart) {
      const key = rowKey(role, part)
      if (!rowMeta.has(key)) {
        rowMeta.set(key, { role, dayPart: part })
        rowOrder.push(key)
      }
    }
  }

  const slotAt = (role: string, dayPart: string, weekday: number) =>
    slots.find((s) => s.role === role && s.day_part === dayPart && s.weekday === weekday)

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border-b border-line px-3 py-2.5 text-right text-[12.5px] text-ink-soft">
              חלק יום / תפקיד
            </th>
            {weekdays.map((wd) => (
              <th
                key={wd}
                className="min-w-[130px] border-b border-line px-2 py-2.5 text-right text-[12.5px] text-ink-soft"
              >
                {WEEKDAY_LABELS[wd]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowOrder.map((key, index) => {
            const { role, dayPart } = rowMeta.get(key)!

            // מעבר מקבוצת "בוקר" לקבוצת "צהריים" — קו מפריד עבה במקום הקו הרגיל הדק
            const prevDayPart = index > 0 ? rowMeta.get(rowOrder[index - 1])!.dayPart : null
            const isDayPartBoundary = prevDayPart !== null && prevDayPart !== dayPart
            const topBorderClass = isDayPartBoundary
              ? 'border-t-2 border-t-ink'
              : 'border-t border-line'

            return (
              <tr key={key}>
                <td className={`${topBorderClass} px-3 py-2 text-[13px] font-medium`}>
                  {role} — {DAY_PART_LABELS[dayPart]}
                </td>
                {weekdays.map((wd) => {
                  if (dayPart === 'afternoon' && wd === FRIDAY_WD) {
                    return (
                      <td
                        key={wd}
                        title="ביום שישי אין צהריים"
                        className={`${topBorderClass} bg-[#f7f6f2] px-2 py-2 text-center text-[12px] text-[#ccc]`}
                      >
                        —
                      </td>
                    )
                  }
                  const slot = slotAt(role, dayPart, wd)
                  if (!slot) {
                    return (
                      <td key={wd} className={`${topBorderClass} px-2 py-2 text-center text-[12px] text-[#ccc]`}>
                        —
                      </td>
                    )
                  }
                  return (
                    <SlotCell
                      key={slot.id}
                      slot={slot}
                      employees={employees}
                      templateId={templateId}
                      topBorderClass={topBorderClass}
                      notes={slot.notes}
                    />
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="border-t border-line px-3 py-2.5 text-[12px] text-ink-soft">
        לחיצה על כל תא פותחת בחירת עובדת קבועה, סימון "חור ריק", או שינוי רמת קריטיות. שינויים
        נשמרים מיידית.
      </div>
    </div>
  )
}
