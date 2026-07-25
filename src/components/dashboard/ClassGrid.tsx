import type { TemplateSlotWithEmployee } from '../../types/schedule'
import { DAY_PART_LABELS, WEEKDAY_LABELS } from '../../types/schedule'
import type { EmployeeWithType } from '../../hooks/useEmployees'
import type { DashboardClassData } from '../../hooks/useDashboard'
import type { SlotOccupancy } from '../../types/dashboard'
import { parseISODate, systemWeekday, toHebrewDateLabel } from '../../lib/dateUtils'
import { occupancyKey, resolveSlotStatus, type ResolveContext } from '../../lib/resolveDashboard'
import { DashboardSlotCell } from './DashboardSlotCell'

interface Props {
  classData: DashboardClassData
  dates: string[]
  ctx: ResolveContext
  employeesById: Map<number, EmployeeWithType>
  allEmployees: EmployeeWithType[]
  occupancyMap: Map<string, SlotOccupancy>
  schoolId: number
  createdBy: string | null
}

function rowKey(role: string, dayPart: string) {
  return `${dayPart}::${role}`
}

const FRIDAY_WEEKDAY = Object.entries(WEEKDAY_LABELS).find(([, label]) => label === 'שישי')?.[0]
const FRIDAY_WD = FRIDAY_WEEKDAY !== undefined ? Number(FRIDAY_WEEKDAY) : undefined

export function ClassGrid({
  classData,
  dates,
  ctx,
  employeesById,
  allEmployees,
  occupancyMap,
  schoolId,
  createdBy,
}: Props) {
  const { classRow, slots } = classData

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-2 text-[13px] font-bold">כיתה {classRow.name}</div>
        <div className="text-[12px] text-ink-soft">אין תבנית שיבוץ בסיסית פעילה לכיתה זו.</div>
      </div>
    )
  }

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
    <div className="rounded-xl border border-line bg-panel">
      <div className="border-b border-line px-3 py-2 text-[13px] font-bold">כיתה {classRow.name}</div>
      <table className="w-full table-fixed border-collapse text-[13px]">
        <colgroup>
          <col className="w-[42px]" />
          {dates.map((date) => (
            <col key={date} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border-b border-line px-0.5 py-1.5 text-right text-[9px] text-ink-soft">
              תפקיד
            </th>
            {dates.map((date) => {
              const wd = systemWeekday(parseISODate(date))
              return (
                <th
                  key={date}
                  className="truncate border-b border-line px-0.5 py-1.5 text-center text-[9px] leading-tight text-ink-soft"
                >
                  <div className="truncate font-medium">{WEEKDAY_LABELS[wd] ?? date}</div>
                  <div className="truncate opacity-60">{toHebrewDateLabel(parseISODate(date))}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rowOrder.map((key, index) => {
            const { role, dayPart } = rowMeta.get(key)!
            const prevDayPart = index > 0 ? rowMeta.get(rowOrder[index - 1])!.dayPart : null
            const isDayPartBoundary = prevDayPart !== null && prevDayPart !== dayPart
            const topBorderClass = isDayPartBoundary ? 'border-t-2 border-t-ink' : 'border-t border-line'

            return (
              <tr key={key}>
                <td
                  title={`${role} — ${DAY_PART_LABELS[dayPart]}`}
                  className={`${topBorderClass} px-0.5 py-1.5 text-[9px] font-medium leading-tight`}
                >
                  <div className="truncate">{role}</div>
                  <div className="truncate font-normal text-ink-soft">{DAY_PART_LABELS[dayPart]}</div>
                </td>
                {dates.map((date) => {
                  const wd = systemWeekday(parseISODate(date))
                  if (dayPart === 'afternoon' && wd === FRIDAY_WD) {
                    return (
                      <td
                        key={date}
                        className={`${topBorderClass} bg-[#f7f6f2] px-1 py-2 text-center text-[12px] text-[#ccc]`}
                      >
                        —
                      </td>
                    )
                  }
                  const slot = slotAt(role, dayPart, wd)
                  if (!slot) {
                    return (
                      <td key={date} className={`${topBorderClass} px-1 py-2 text-center text-[12px] text-[#ccc]`}>
                        —
                      </td>
                    )
                  }
                  const status = resolveSlotStatus(slot, date, ctx)
                  const getOccupancy = (employeeId: number) =>
                    occupancyMap.get(occupancyKey(date, dayPart, employeeId)) ?? null
                  return (
                    <DashboardSlotCell
                      key={`${slot.id}:${date}`}
                      slot={slot}
                      classId={classRow.id}
                      className={classRow.name}
                      date={date}
                      status={status}
                      employeesById={employeesById}
                      allEmployees={allEmployees}
                      getOccupancy={getOccupancy}
                      schoolId={schoolId}
                      createdBy={createdBy}
                      topBorderClass={topBorderClass}
                    />
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
