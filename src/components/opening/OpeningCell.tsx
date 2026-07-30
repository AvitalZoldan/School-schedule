import { useState } from 'react'
import type { OpeningAssignmentRow, OpeningRoleWithAssignments } from '../../types/opening'
import type { EmployeeWithType } from '../../hooks/useEmployees'
import { useUpsertOpeningAssignment, type CampOpeningContext } from '../../hooks/useOpeningRoster'
import { useConfirm } from '../common/ConfirmProvider'
import { buildTransferConfirmMessage } from '../../lib/conflictMessages'

interface Props {
  schoolId: number
  roleId: number
  weekday: number
  assignment: OpeningAssignmentRow | undefined
  // רק העובדות שמשובצות לחור בוקר כלשהו ביום הזה — לא כל הרשימה הכללית
  availableEmployees: EmployeeWithType[]
  // כל תפקידי הפתיחה עם השיבוצים שלהם (אותו הקשר: רגיל, או אותה קייטנה+שבוע) — לבדיקה
  // שאותה עובדת לא משובצת כבר לתפקיד פתיחה אחר באותו יום (פתיחה היא "פעם אחת ביום")
  roster: OpeningRoleWithAssignments[]
  campContext?: CampOpeningContext
}

export function OpeningCell({
  schoolId,
  roleId,
  weekday,
  assignment,
  availableEmployees,
  roster,
  campContext,
}: Props) {
  const [open, setOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState(assignment?.notes ?? '')
  const upsert = useUpsertOpeningAssignment()
  const confirm = useConfirm()

  const employeeId = assignment?.employee_id ?? null
  const employee = availableEmployees.find((e) => e.id === employeeId)
  const isFilled = !!employeeId

  function openPopover() {
    setNotesDraft(assignment?.notes ?? '')
    setOpen((o) => !o)
  }

  function saveNotes() {
    upsert.mutate({
      schoolId,
      assignmentId: assignment?.id,
      roleId,
      weekday,
      employeeId,
      notes: notesDraft.trim() || null,
      campContext,
    })
  }

  return (
    <td className="relative border-t border-line px-1.5 py-2 align-top">
      <button
        type="button"
        onClick={openPopover}
        className={`w-full whitespace-normal break-words rounded-md px-2 py-1.5 text-right text-[12px] leading-snug transition-opacity hover:opacity-80 ${
          isFilled ? 'bg-accent-soft text-accent' : 'bg-danger-soft font-semibold text-danger'
        }`}
      >
        {employee ? employee.full_name : 'לא מאויש'}
        {assignment?.notes && (
          <div className="mt-0.5 break-words text-[10.5px] font-normal opacity-70">
            {assignment.notes}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 flex w-56 flex-col gap-1.5 rounded-md border border-line bg-panel p-2 shadow-md">
          {availableEmployees.length === 0 ? (
            <div className="px-1 py-1 text-[11.5px] text-ink-soft">
              אין עובדות המשובצות לבוקר ביום זה בשיבוץ הבסיסי.
            </div>
          ) : (
            <select
              className="rounded border border-line bg-white px-1.5 py-1 text-[12px]"
              value={employeeId ?? ''}
              onChange={async (e) => {
                const val = e.target.value
                const newEmployeeId = val === '' ? null : Number(val)
                if (newEmployeeId !== null) {
                  const conflictRole = roster.find(
                    (r) => r.id !== roleId && r.assignments[weekday]?.employee_id === newEmployeeId,
                  )
                  if (conflictRole) {
                    const employeeName =
                      availableEmployees.find((emp) => emp.id === newEmployeeId)?.full_name ?? 'העובדת'
                    const message = buildTransferConfirmMessage(employeeName, `ביום זה לתפקיד פתיחה "${conflictRole.name}"`)
                    if (!(await confirm(message))) return
                    const conflictAssignment = conflictRole.assignments[weekday]
                    if (conflictAssignment) {
                      await upsert.mutateAsync({
                        schoolId,
                        assignmentId: conflictAssignment.id,
                        roleId: conflictRole.id,
                        weekday,
                        employeeId: null,
                        notes: conflictAssignment.notes ?? null,
                        campContext,
                      })
                    }
                  }
                }
                upsert.mutate({
                  schoolId,
                  assignmentId: assignment?.id,
                  roleId,
                  weekday,
                  employeeId: newEmployeeId,
                  notes: assignment?.notes ?? null,
                  campContext,
                })
              }}
            >
              <option value="">— חור ריק —</option>
              {availableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                  {emp.employee_type ? ` (${emp.employee_type.label})` : ''}
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
            className="rounded border border-line bg-white px-1.5 py-1 text-[12px]"
          />
        </div>
      )}
    </td>
  )
}
