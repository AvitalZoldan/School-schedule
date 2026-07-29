import { useAuth } from '../lib/AuthContext'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useSchoolSettings, useUpdateSchoolSettings, type DashboardDefaultRange } from '../hooks/useSchoolSettings'
import { SegmentedToggle } from '../components/common/SegmentedToggle'

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
      </div>
    </div>
  )
}
