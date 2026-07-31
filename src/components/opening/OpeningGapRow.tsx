import type { EmployeeWithType } from '../../hooks/useEmployees'
import { useAssignDailyOpening, useClearDailyOpening } from '../../hooks/useOpeningRoster'
import type { OpeningGap } from '../../lib/resolveDashboard'
import { DAY_PART_LABELS } from '../../types/schedule'
import type { SlotOccupancy } from '../../types/dashboard'
import { useConfirm } from '../common/ConfirmProvider'
import { EmployeeHoverCard } from '../common/EmployeeHoverCard'
import { SubstituteCombobox } from '../dashboard/SubstituteCombobox'

interface Props {
  gap: OpeningGap
  morningStaff: EmployeeWithType[]
  employeesById: Map<number, EmployeeWithType>
  getOccupancy: (employeeId: number) => SlotOccupancy | null
  schoolId: number
  createdBy: string | null
}

// שורת "חור פתיחה" בודדת (5.7-ג המורחב): תפקיד פתיחה שהתפנה לתאריך ספציפי כי העובדת הקבועה
// נעדרת/בחופשה אותו יום בלבד — לא נוגע בשיבוץ השבועי הקבוע (מסך "מערכת פתיחות"). רשימת
// הבחירה זהה לזו שבמסך "מערכת פתיחות": כל מי שמשובצת לחור בוקר כלשהו באותו יום בשבוע — ולכן
// כל מועמדת כאן כבר משובצת בכיתה כלשהי אותו בוקר (בניגוד לחור בכיתה, כאן זה שיבוץ נוסף ולא
// העברה: היא ממשיכה גם בתפקידה הרגיל). מבקשים אישור לפני שיבוץ, בדיוק כמו בדשבורד, כדי
// שהאחראית תדע במפורש שהעובדת כבר עסוקה במקום אחר אותו בוקר.
export function OpeningGapRow({ gap, morningStaff, employeesById, getOccupancy, schoolId, createdBy }: Props) {
  const assignOpening = useAssignDailyOpening()
  const clearOpening = useClearDailyOpening()
  const confirm = useConfirm()

  const absentEmployee = gap.absentEmployeeId != null ? employeesById.get(gap.absentEmployeeId) : null
  const absentName =
    gap.absentEmployeeId != null ? (absentEmployee?.full_name ?? `עובדת #${gap.absentEmployeeId}`) : null
  const availableStaff = morningStaff.filter((e) => e.id !== gap.absentEmployeeId)

  async function handleSelect(employeeId: number) {
    const occupancy = getOccupancy(employeeId)
    if (occupancy) {
      const employeeName = employeesById.get(employeeId)?.full_name ?? ''
      const message = `${employeeName} כבר משובצת ב${occupancy.className}, ${DAY_PART_LABELS[occupancy.dayPart]} - ${occupancy.role}. לשבץ אותה גם לתפקיד פתיחה זה?`
      if (!(await confirm(message))) return
    }
    assignOpening.mutate({ schoolId, roleId: gap.roleId, date: gap.date, employeeId, createdBy })
  }

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-line bg-white px-2.5 py-1.5">
      <div className="min-w-0 flex-1 truncate text-[12.5px]">
        <span className="font-semibold">{gap.roleName}</span>
        <span className="text-ink-soft">
          {' · '}
          {absentName ? (
            <>
              <EmployeeHoverCard employee={absentEmployee}>{absentName}</EmployeeHoverCard> נעדרת
            </>
          ) : (
            'לא משובצת'
          )}
        </span>
      </div>
      <div className="w-44 shrink-0">
        {gap.dailyAssignment ? (
          <div className="flex items-center gap-1 rounded border-r-[3px] border-current bg-ok-soft px-1.5 py-1 text-[11.5px] text-ok">
            <span className="flex-1 truncate">
              <EmployeeHoverCard employee={employeesById.get(gap.dailyAssignment.employee_id)}>
                {employeesById.get(gap.dailyAssignment.employee_id)?.full_name ?? '—'}
              </EmployeeHoverCard>
            </span>
            <button
              type="button"
              onClick={() => clearOpening.mutate({ schoolId, assignmentId: gap.dailyAssignment!.id })}
              aria-label="בטל שיבוץ"
              className="shrink-0 rounded px-1 text-[13px] leading-none hover:opacity-60"
            >
              ✕
            </button>
          </div>
        ) : (
          <SubstituteCombobox employees={availableStaff} getOccupancy={getOccupancy} onSelect={handleSelect} />
        )}
      </div>
    </div>
  )
}
