import type { TemplateSlotWithEmployee } from '../../types/schedule'
import { DAY_PART_LABELS } from '../../types/schedule'
import type { SlotDayStatus, SlotOccupancy } from '../../types/dashboard'
import type { EmployeeWithType } from '../../hooks/useEmployees'
import { useAssignDailySlot, useClearDailyAssignment, useMarkAbsence } from '../../hooks/useDashboard'
import { useConfirm } from '../common/ConfirmProvider'
import { EmployeeHoverCard } from '../common/EmployeeHoverCard'
import { SubstituteCombobox } from '../dashboard/SubstituteCombobox'

interface Props {
  slot: TemplateSlotWithEmployee
  classId: number
  className: string
  date: string
  status: Extract<SlotDayStatus, { kind: 'missing' | 'filled_sub' }>
  employeesById: Map<number, EmployeeWithType>
  allEmployees: EmployeeWithType[]
  getOccupancy: (employeeId: number) => SlotOccupancy | null
  schoolId: number
  createdBy: string | null
  showClassName?: boolean
}

// שורת "חור" בודדת במסך החוסרים — אותה לוגיקת שיבוץ/העברה כמו DashboardSlotCell,
// אך כשורה ברשימה שטוחה (לא תא בטבלת כיתה), כדי שאחראית מ"מ תראה רק את החוסרים
export function MissingSlotRow({
  slot,
  classId,
  className,
  date,
  status,
  employeesById,
  allEmployees,
  getOccupancy,
  schoolId,
  createdBy,
  showClassName = true,
}: Props) {
  const assignSlot = useAssignDailySlot()
  const clearAssignment = useClearDailyAssignment()
  const confirm = useConfirm()

  function performAssign(employeeId: number, existingAssignmentId?: number) {
    assignSlot.mutate({
      schoolId,
      slotId: slot.id,
      date,
      employeeId,
      classId,
      role: slot.role,
      dayPart: slot.day_part,
      createdBy,
      existingAssignmentId,
    })
  }

  async function handleSelect(employeeId: number, existingAssignmentId?: number) {
    const occupancy = getOccupancy(employeeId)
    const isCurrentSlot =
      occupancy &&
      occupancy.className === className &&
      occupancy.role === slot.role &&
      occupancy.dayPart === slot.day_part
    if (occupancy && !isCurrentSlot) {
      if (occupancy.kind === 'filled_leave_sub') {
        alert('לא ניתן להעביר מ"מ ששויכה מראש דרך מסך "חופשות" — יש לערוך משם.')
        return
      }
      const employeeName = employeesById.get(employeeId)?.full_name ?? ''
      const message = `האם למחוק את ${employeeName} מ${occupancy.className} ${DAY_PART_LABELS[occupancy.dayPart]} - ${occupancy.role}?`
      if (!(await confirm(message))) return

      if (occupancy.kind === 'filled_sub' && occupancy.assignmentId) {
        clearAssignment.mutate({ schoolId, assignmentId: occupancy.assignmentId })
      }
    }
    performAssign(employeeId, existingAssignmentId)
  }

  const isCritical = status.kind === 'missing' && status.criticality === 'critical'

  // רק מ"מ שאינן משובצות במקום אחר באותו תאריך+חלק-יום — לא רשימת עובדות מלאה עם תג "תפוסה"
  const availableSubs = allEmployees.filter((e) => e.status === 'substitute' && !getOccupancy(e.id))

  const actionControl =
    status.kind === 'missing' ? (
      <SubstituteCombobox employees={availableSubs} onSelect={(employeeId) => handleSelect(employeeId)} />
    ) : (
      <div className="flex items-center gap-1 rounded border-r-[3px] border-current bg-ok-soft px-1.5 py-1 text-[11.5px] text-ok">
        <span className="flex-1 truncate">
          <EmployeeHoverCard employee={employeesById.get(status.employeeId)}>
            {employeesById.get(status.employeeId)?.full_name ?? '—'}
          </EmployeeHoverCard>
        </span>
        <button
          type="button"
          onClick={() => clearAssignment.mutate({ schoolId, assignmentId: status.assignmentId })}
          aria-label="בטל שיבוץ"
          className="shrink-0 rounded px-1 text-[13px] leading-none hover:opacity-60"
        >
          ✕
        </button>
      </div>
    )

  const label = (
    <div className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px]">
      {isCritical && (
        <span className="shrink-0 rounded-full bg-danger px-1.5 py-0.5 text-[9.5px] font-semibold text-white">
          קריטי
        </span>
      )}
      {showClassName && (
        <>
          <span className="truncate font-semibold">כיתה {className}</span>
          <span className="shrink-0 text-ink-soft">·</span>
        </>
      )}
      <span className="truncate text-ink-soft">{slot.role}</span>
    </div>
  )

  if (!showClassName) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-line bg-white px-2 py-1.5">
        {label}
        {actionControl}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-line bg-white px-2.5 py-1.5">
      <div className="min-w-0 flex-1">{label}</div>
      <div className="w-44 shrink-0">{actionControl}</div>
    </div>
  )
}
