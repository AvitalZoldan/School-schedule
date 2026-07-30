import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useSchoolSettings, useUpdateSchoolSettings, type DashboardDefaultRange } from '../hooks/useSchoolSettings'
import { useSchoolHolidays, useSetHoliday, useRemoveHoliday } from '../hooks/useHolidays'
import { formatDisplayDate, parseISODate, systemWeekday, type DateDisplayMode } from '../lib/dateUtils'
import { WEEKDAY_LABELS } from '../types/schedule'
import { SegmentedToggle } from '../components/common/SegmentedToggle'
import { useConfirm } from '../components/common/ConfirmProvider'

export default function Management() {
  const schoolId = useCurrentSchoolId()
  const { profile } = useAuth()
  const canEdit = profile?.permission_level === 'full'

  const { data: settings, isLoading } = useSchoolSettings(schoolId)
  const updateSettings = useUpdateSchoolSettings()

  function setDashboardDefaultRange(value: DashboardDefaultRange) {
    if (!schoolId) return
    updateSettings.mutate({ schoolId, patch: { dashboard_default_range: value } })
  }

  function setDateDisplay(value: DateDisplayMode) {
    if (!schoolId) return
    updateSettings.mutate({ schoolId, patch: { date_display: value } })
  }

  const dateDisplayMode = settings?.date_display ?? 'hebrew'

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">ניהול</h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-panel p-[18px]">
          <div className="mb-1 text-[13px] font-bold">ברירת מחדל בלוח בקרה</div>
          <div className="mb-3 text-[12px] text-ink-soft">
            איזו תצוגה תיפתח כברירת מחדל בכניסה למסך "לוח בקרה" — יום נוכחי או שבוע נוכחי.
          </div>

          {isLoading || !settings ? (
            <div className="text-[12.5px] text-ink-soft">טוען…</div>
          ) : (
            <div className="print:hidden">
              <SegmentedToggle
                value={settings.dashboard_default_range}
                onChange={setDashboardDefaultRange}
                disabled={!canEdit}
                options={[
                  { value: 'day', label: 'יום' },
                  { value: 'week', label: 'שבוע' },
                ]}
              />
            </div>
          )}

          {!canEdit && (
            <div className="mt-2 text-[11.5px] text-ink-soft">
              משתמשת בהרשאת צפייה בלבד — אין אפשרות לשנות הגדרה זו.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-panel p-[18px]">
          <div className="mb-1 text-[13px] font-bold">תצוגת תאריכים</div>
          <div className="mb-3 text-[12px] text-ink-soft">
            באיזה לוח שנה יוצגו תאריכים במערכת — עברי, לועזי, או שניהם יחד.
          </div>

          {isLoading || !settings ? (
            <div className="text-[12.5px] text-ink-soft">טוען…</div>
          ) : (
            <div className="print:hidden">
              <SegmentedToggle
                value={settings.date_display}
                onChange={setDateDisplay}
                disabled={!canEdit}
                options={[
                  { value: 'hebrew', label: 'עברי' },
                  { value: 'gregorian', label: 'לועזי' },
                  { value: 'both', label: 'גם וגם' },
                ]}
              />
            </div>
          )}

          {!canEdit && (
            <div className="mt-2 text-[11.5px] text-ink-soft">
              משתמשת בהרשאת צפייה בלבד — אין אפשרות לשנות הגדרה זו.
            </div>
          )}
        </div>

        <HolidaysSection schoolId={schoolId} canEdit={canEdit} dateDisplayMode={dateDisplayMode} />
      </div>
    </div>
  )
}

function HolidaysSection({
  schoolId,
  canEdit,
  dateDisplayMode,
}: {
  schoolId: number | undefined
  canEdit: boolean
  dateDisplayMode: DateDisplayMode
}) {
  const { data: holidays, isLoading } = useSchoolHolidays(schoolId)
  const setHoliday = useSetHoliday()
  const removeHoliday = useRemoveHoliday()
  const confirm = useConfirm()

  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!schoolId || !date) {
      setFormError('יש לבחור תאריך')
      return
    }
    try {
      await setHoliday.mutateAsync({ schoolId, date, label: label.trim() || null })
      setDate('')
      setLabel('')
    } catch {
      setFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  async function handleRemove(holidayDate: string, holidayLabel: string | null) {
    if (!schoolId) return
    const message = holidayLabel
      ? `לבטל את "${holidayLabel}" כיום חופש?`
      : 'לבטל את יום החופש הזה?'
    if (!(await confirm(message))) return
    removeHoliday.mutate({ schoolId, date: holidayDate })
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-[18px]">
      <div className="mb-1 text-[13px] font-bold">ימי חופש</div>
      <div className="mb-3 text-[12px] text-ink-soft">
        תאריך שמסומן כיום חופש מוצג כלא-פעיל בלוח הבקרה (בלי שיבוץ צוות), ומוסתר לגמרי ממסך "שיבוץ
        מ"מ".
      </div>

      {canEdit && (
        <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
          <label className="block">
            <span className="mb-1 block text-[12px] text-ink-soft">תאריך</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </label>
          <label className="block flex-1 min-w-[140px]">
            <span className="mb-1 block text-[12px] text-ink-soft">תיאור (רשות)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="למשל: ראש השנה"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={setHoliday.isPending}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {setHoliday.isPending ? 'מוסיפה…' : '+ הוספת יום חופש'}
          </button>
        </form>
      )}

      {formError && (
        <div className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{formError}</div>
      )}

      {isLoading ? (
        <div className="text-[12.5px] text-ink-soft">טוען…</div>
      ) : holidays && holidays.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {holidays.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[13px]"
            >
              <div>
                <span className="font-medium">
                  {WEEKDAY_LABELS[systemWeekday(parseISODate(h.holiday_date))]}{' '}
                  {formatDisplayDate(parseISODate(h.holiday_date), dateDisplayMode)}
                </span>
                {h.label && <span className="mr-2 text-ink-soft">— {h.label}</span>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(h.holiday_date, h.label)}
                  className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[12.5px] text-ink-soft">אין ימי חופש מוגדרים.</div>
      )}
    </div>
  )
}
