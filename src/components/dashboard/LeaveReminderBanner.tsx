import { useLeaveReminders, useDismissLeaveReminder } from '../../hooks/useLeaves'
import { parseISODate, toGregorianDateLabel } from '../../lib/dateUtils'
import { useAuth } from '../../lib/AuthContext'

interface Props {
  schoolId: number
}

// באנר תזכורת "X ימים לפני חזרה" (3.7 באפיון): מופיע בראש הדשבורד כשהגיע תאריך התזכורת של
// חופשה פעילה. סגירה ע"י המשתמשת פר-משתמשת (leave_reminder_dismissals) — לא תוצג שוב
// עבורה, אך ממשיכה להופיע אצל שאר המשתמשות עד שכל אחת תסגור בעצמה (אלא אם טווח החופשה נערך
// מחדש — ראו useUpdateLeave).
export function LeaveReminderBanner({ schoolId }: Props) {
  const { profile } = useAuth()
  const { data: reminders } = useLeaveReminders(schoolId, profile?.id)
  const dismissReminder = useDismissLeaveReminder()

  if (!reminders || reminders.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-warn bg-warn-soft p-3">
      {reminders.map((leave) => (
        <div key={leave.id} className="flex items-center justify-between gap-3 text-[13px] text-warn">
          <div>
            <span className="font-semibold">{leave.employee?.full_name ?? '—'}</span>
            {' '}אמורה לחזור מחופשה בתאריך {toGregorianDateLabel(parseISODate(leave.end_date))}.
          </div>
          <button
            type="button"
            onClick={() => profile && dismissReminder.mutate({ schoolId, leaveId: leave.id, profileId: profile.id })}
            className="shrink-0 rounded-md border border-warn px-2 py-1 text-[12px] hover:bg-white/40"
          >
            הבנתי
          </button>
        </div>
      ))}
    </div>
  )
}
