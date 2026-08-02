import { useState } from 'react'
import type { TemplateSlotWithEmployee } from '../../types/schedule'
import { DAY_PART_LABELS } from '../../types/schedule'
import type { SlotDayStatus, SlotOccupancy } from '../../types/dashboard'
import type { EmployeeWithType } from '../../hooks/useEmployees'
import { useAssignDailySlot, useClearDailyAssignment, useMarkAbsence, useSetSlotUrgency } from '../../hooks/useDashboard'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useConfirm } from '../common/ConfirmProvider'
import { EmployeeHoverCard } from '../common/EmployeeHoverCard'
import { buildTransferConfirmMessage } from '../../lib/conflictMessages'
import { SubstituteCombobox } from './SubstituteCombobox'

interface Props {
  slot: TemplateSlotWithEmployee
  classId: number
  className: string
  date: string
  status: SlotDayStatus
  employeesById: Map<number, EmployeeWithType>
  allEmployees: EmployeeWithType[]
  getOccupancy: (employeeId: number) => SlotOccupancy | null
  schoolId: number
  createdBy: string | null
  topBorderClass?: string
}

export function DashboardSlotCell({
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
  topBorderClass = 'border-t border-line',
}: Props) {
  const [open, setOpen] = useState(false)
  const assignSlot = useAssignDailySlot()
  const clearAssignment = useClearDailyAssignment()
  const markAbsence = useMarkAbsence()
  const setUrgency = useSetSlotUrgency()
  const confirm = useConfirm()
  const cellRef = useClickOutside<HTMLTableCellElement>(open, () => setOpen(false))

  async function performAssign(employeeId: number, existingAssignmentId?: number) {
    try {
      await assignSlot.mutateAsync({
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
    } catch (error) {
      alert(`השיבוץ נכשל: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`)
      return
    }
    setOpen(false)
  }

  // בוחרים עובדת שכבר תפוסה במקום אחר לאותו תאריך+חלק-יום: לפני שמשבצים אותה כאן, מבקשים
  // אישור "להעביר" אותה — כלומר לפנות אותה מהחור הישן ולשבץ בחדש (במקום לחסום את הבחירה מראש).
  // חשוב: הפינוי חייב להסתיים (await) לפני השיבוץ החדש — אחרת שני השינויים רצים במקביל, ואם
  // השיבוץ החדש מגיע ל-DB לפני שהפינוי הסתיים, ה-constraint שמונע כפילות חוסם אותו (בשקט,
  // בלי הודעת שגיאה) בעוד שהפינוי הישן כבר הצליח — התוצאה: העובדת נעלמת מהמקור ולא מופיעה ביעד.
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
      const message = buildTransferConfirmMessage(
        employeeName,
        `ב${occupancy.className} ${DAY_PART_LABELS[occupancy.dayPart]} בתפקיד "${occupancy.role}"`,
      )
      if (!(await confirm(message))) return

      try {
        if (occupancy.kind === 'filled_sub' && occupancy.assignmentId) {
          await clearAssignment.mutateAsync({ schoolId, assignmentId: occupancy.assignmentId })
        } else if (occupancy.kind === 'filled_permanent') {
          await markAbsence.mutateAsync({ schoolId, employeeId, date, dayPart: occupancy.dayPart, reportedBy: createdBy })
        }
      } catch (error) {
        alert(`פינוי השיבוץ הקודם נכשל: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`)
        return
      }
    }
    performAssign(employeeId, existingAssignmentId)
  }

  // "לא נדרש" קבוע בתבנית (בלי דריסה חד-פעמית) — תא סטטי בלי אפשרות אינטראקציה, כמו במסך
  // שיבוץ בסיסי. אם כן קיימת דריסה (המשבצת בדרך כלל קריטית/רגילה אך סומנה כ"לא נדרש" להיום
  // בלבד), התא כן ניתן ללחיצה כדי לאפשר איפוס בחזרה.
  if (status.kind === 'not_required' && !status.isUrgencyOverridden) {
    return (
      <td className={`${topBorderClass} px-1 py-2 text-center text-[12px] text-[#ccc]`}>—</td>
    )
  }

  const isCritical = status.kind === 'missing' && status.criticality === 'critical'
  const urgencyValue = status.kind === 'missing' ? status.criticality : status.kind === 'not_required' ? 'not_required' : null

  const cellClass =
    status.kind === 'filled_permanent'
      ? 'bg-[#dbeafe] text-[#1d4ed8]'
      : status.kind === 'filled_sub' || status.kind === 'filled_leave_sub'
        ? 'bg-ok-soft text-ok'
        : status.kind === 'not_required'
          ? 'bg-[#f2f0ea] text-[#999]'
          : 'bg-danger-soft text-danger'

  const labelEmployee =
    status.kind === 'filled_permanent' || status.kind === 'filled_sub' || status.kind === 'filled_leave_sub'
      ? employeesById.get(status.employeeId)
      : undefined
  const label =
    labelEmployee?.full_name ??
    (status.kind === 'missing' ? 'חור ריק' : status.kind === 'not_required' ? 'לא נדרש' : '—')

  return (
    <td ref={cellRef} className={`relative ${topBorderClass} px-0.5 py-1.5 align-top`}>
      {isCritical && (
        <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-danger px-1 py-0.5 text-[8.5px] font-semibold text-white">
          קריטי
        </span>
      )}
      {status.kind === 'filled_permanent' ? (
        <div
          title={label}
          className={`w-full overflow-hidden rounded-md border-r-[3px] border-current px-1 py-1 text-right text-[10px] ${cellClass}`}
        >
          <div className="truncate">
            {labelEmployee ? (
              <EmployeeHoverCard
                employee={labelEmployee}
                onMarkAbsent={() =>
                  markAbsence.mutate({
                    schoolId,
                    employeeId: status.employeeId,
                    date,
                    dayPart: slot.day_part,
                    reportedBy: createdBy,
                  })
                }
              >
                {label}
              </EmployeeHoverCard>
            ) : (
              label
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          title={label}
          onClick={() => setOpen((o) => !o)}
          className={`w-full overflow-hidden rounded-md border-r-[3px] border-current px-1 py-1 text-right text-[10px] transition-opacity hover:opacity-80 ${cellClass}`}
        >
          <div className="truncate">
            {labelEmployee ? <EmployeeHoverCard employee={labelEmployee}>{label}</EmployeeHoverCard> : label}
          </div>
          {status.kind === 'filled_sub' && (
            <div className="truncate text-[9px] font-normal opacity-70">מ"מ</div>
          )}
          {status.kind === 'filled_leave_sub' && (
            <div className="truncate text-[9px] font-normal opacity-70">מ"מ (חופשה)</div>
          )}
        </button>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-md border border-line bg-panel p-2 shadow-md">
          {(status.kind === 'missing' || status.kind === 'not_required') && (
            <div className="flex flex-col gap-1.5">
              {status.kind === 'missing' && (
                <SubstituteCombobox
                  employees={allEmployees}
                  getOccupancy={getOccupancy}
                  onSelect={(employeeId) => handleSelect(employeeId)}
                />
              )}
              <div className="flex items-center gap-1.5 border-t border-line pt-1.5">
                <select
                  className={`w-full flex-1 rounded border border-line px-2 py-1.5 text-[12.5px] ${
                    urgencyValue === 'critical'
                      ? 'bg-danger-soft text-danger'
                      : urgencyValue === 'not_required'
                        ? 'bg-[#f2f0ea] text-[#999]'
                        : 'bg-accent-soft text-accent'
                  }`}
                  value={urgencyValue ?? 'normal'}
                  onChange={(e) =>
                    setUrgency.mutate({
                      schoolId,
                      slotId: slot.id,
                      date,
                      urgency: e.target.value as 'critical' | 'normal' | 'not_required',
                    })
                  }
                >
                  <option value="critical">קריטי</option>
                  <option value="normal">רגיל</option>
                  <option value="not_required">לא נדרש</option>
                </select>
              </div>
            </div>
          )}

          {status.kind === 'filled_sub' && (
            <div className="flex flex-col gap-1.5">
              <SubstituteCombobox
                employees={allEmployees}
                getOccupancy={getOccupancy}
                onSelect={(employeeId) => handleSelect(employeeId, status.assignmentId)}
              />
              <button
                type="button"
                onClick={() => {
                  clearAssignment.mutate({ schoolId, assignmentId: status.assignmentId })
                  setOpen(false)
                }}
                className="rounded bg-[#f2f0ea] px-2 py-1 text-right text-[12px] text-ink-soft hover:opacity-80"
              >
                בטל שיבוץ
              </button>
            </div>
          )}

          {status.kind === 'filled_leave_sub' && (
            <div className="text-[11px] text-ink-soft">
              מ"מ שויכה מראש דרך מסך "חופשות" — לעריכה יש לפתוח שם.
            </div>
          )}
        </div>
      )}
    </td>
  )
}
