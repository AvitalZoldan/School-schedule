import { useState } from 'react'
import { DAY_PART_LABELS, WEEKDAY_LABELS, type Criticality, type TemplateSlotWithEmployee } from '../../types/schedule'
import type { EmployeeWithType } from '../../hooks/useEmployees'
import { useUpdateSlot, type SlotForConflictCheck } from '../../hooks/useSchedule'
import { useConfirm } from '../common/ConfirmProvider'
import { buildTransferConfirmMessage } from '../../lib/conflictMessages'
import { EmployeeCombobox } from './EmployeeCombobox'

const CRITICALITY_LABEL: Record<Criticality, string> = {
  critical: 'קריטי',
  normal: 'רגיל',
  not_required: 'לא נדרש',
}

const CRITICALITY_BADGE_CLASS: Record<Criticality, string> = {
  critical: 'bg-danger-soft text-danger',
  normal: 'bg-accent-soft text-accent',
  not_required: 'bg-[#f2f0ea] text-[#999]',
}

interface Props {
  slot: TemplateSlotWithEmployee
  employees: EmployeeWithType[]
  templateId: number
  topBorderClass?: string
  notes: string | null
  // כל החורים המשובצים בבית הספר (כל הכיתות) עבור אותה תבנית mode+status — לבדיקת כפילות
  // שיבוץ לפני שמירה. ראו useSchoolSlotsForConflictCheck.
  conflictSlots?: SlotForConflictCheck[]
  classNameById?: Map<number, string>
}

export function SlotCell({
  slot,
  employees,
  templateId,
  topBorderClass = 'border-t border-line',
  conflictSlots,
  classNameById,
}: Props) {
  const [open, setOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState(slot.notes || '')
  const saveNotes = () => {
    updateSlot.mutate({
      slotId: slot.id,
      templateId,
      assigned_employee_id: slot.assigned_employee_id,
      notes: notesDraft,
    })
  }
  const updateSlot = useUpdateSlot()
  const confirm = useConfirm()
  const isTeacher = slot.role.includes('מורה')

  const displayLabel = slot.employee
    ? slot.employee.full_name
    : slot.criticality === 'not_required'
      ? '—'
      : 'חור ריק — מ"מ'

  const cellClass = slot.employee
    ? isTeacher
      ? 'bg-[#dbeafe] text-[#1d4ed8]'
      : 'bg-accent-soft text-accent'
    : slot.criticality === 'not_required'
      ? 'bg-[#f2f0ea] text-[#999]'
      : 'bg-warn-soft text-warn'

  return (
    <td className={`relative ${topBorderClass} px-2 py-2 align-top`}>
      {!slot.employee && slot.criticality === 'critical' && (
        <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger">
          קריטי
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full rounded-md border-r-4 border-current px-2 py-1.5 text-right text-[12.5px] transition-opacity hover:opacity-80 ${cellClass}`}
      >
        {displayLabel}
        {slot.notes && (
          <div className="mt-0.5 break-words text-[10.5px] font-normal opacity-70">
            {slot.notes}
          </div>
        )}
      </button>

      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5 rounded-md border border-line bg-panel p-2 shadow-sm">
          <EmployeeCombobox
            employees={employees}
            value={slot.assigned_employee_id}
            onChange={async (employeeId) => {
              if (employeeId !== null) {
                const conflict = conflictSlots?.find(
                  (s) =>
                    s.id !== slot.id &&
                    s.weekday === slot.weekday &&
                    s.day_part === slot.day_part &&
                    s.assigned_employee_id === employeeId,
                )
                if (conflict) {
                  const employeeName = employees.find((e) => e.id === employeeId)?.full_name ?? 'העובדת'
                  const className = classNameById?.get(conflict.class_id) ?? '?'
                  const message = buildTransferConfirmMessage(
                    employeeName,
                    `ביום ${WEEKDAY_LABELS[slot.weekday]} ${DAY_PART_LABELS[slot.day_part]} בתפקיד "${conflict.role}" בכיתה ${className}`,
                  )
                  if (!(await confirm(message))) return
                  await updateSlot.mutateAsync({
                    slotId: conflict.id,
                    templateId: conflict.template_id,
                    assigned_employee_id: null,
                  })
                }
              }
              updateSlot.mutate({
                slotId: slot.id,
                templateId,
                assigned_employee_id: employeeId,
              })
            }}
          />

          {!slot.employee && (
            <select
              className={`rounded border border-line px-1.5 py-1 text-[12px] ${CRITICALITY_BADGE_CLASS[slot.criticality]}`}
              value={slot.criticality}
              onChange={(e) => {
                updateSlot.mutate({
                  slotId: slot.id,
                  templateId,
                  assigned_employee_id: slot.assigned_employee_id,
                  criticality: e.target.value as Criticality,
                })
              }}
            >
              {(Object.keys(CRITICALITY_LABEL) as Criticality[]).map((c) => (
                <option key={c} value={c}>
                  {CRITICALITY_LABEL[c]}
                </option>
              ))}
            </select>
          )}

          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            placeholder="הערה (אופציונלי)"
            rows={2}
            className="w-full rounded border border-line bg-white px-1.5 py-1 text-[12px]"
          />
        </div>
      )}
    </td>
  )
}
