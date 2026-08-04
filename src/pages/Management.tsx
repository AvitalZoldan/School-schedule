import { useState, type FormEvent } from 'react'
import { useNamedItemForm } from '../hooks/useNamedItemForm'
import { Pencil, Trash2, RotateCcw } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useCurrentSchoolId } from '../hooks/useSchool'
import {
  useSchoolSettings,
  useUpdateSchoolSettings,
  useStartNewYear,
  type DashboardDefaultRange,
} from '../hooks/useSchoolSettings'
import { useSchoolHolidays, useSetHoliday, useRemoveHoliday } from '../hooks/useHolidays'
import { ImportHolidaysModal } from '../components/employees/ImportHolidaysModal'
import {
  useEmployeeCategoriesOverview,
  useCreateEmployeeCategory,
  useUpdateEmployeeCategory,
} from '../hooks/useEmployeeCategories'
import {
  useRoleTypesOverview,
  useCreateRoleType,
  useUpdateRoleType,
  useUpdateRoleTypeDefault,
  type RoleTypeWithDefaults,
} from '../hooks/useRoleTypes'
import { formatDisplayDate, parseISODate, systemWeekday, type DateDisplayMode } from '../lib/dateUtils'
import { WEEKDAY_LABELS, type Criticality, type DayPart, type EmployeeCategoryRow } from '../types/schedule'
import { SegmentedToggle } from '../components/common/SegmentedToggle'
import { useConfirm } from '../components/common/ConfirmProvider'

const DEFAULT_CATEGORY_COLOR = '#3b82f6'

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

        <DayPartHoursSection schoolId={schoolId} canEdit={canEdit} />

        <RoleTypesSection schoolId={schoolId} canEdit={canEdit} />

        <CategoriesSection schoolId={schoolId} canEdit={canEdit} />

        <HolidaysSection schoolId={schoolId} canEdit={canEdit} dateDisplayMode={dateDisplayMode} />

        <NewYearSection schoolId={schoolId} canEdit={canEdit} />
      </div>
    </div>
  )
}

const NEW_YEAR_CONFIRM_TEXT = 'איפוס שנה'

// "התחלת שנה חדשה" (אזור סכנה): מארכבת (סימון archived_at בלבד, לא DELETE) תבניות שיבוץ,
// חופשות, קייטנות, ימי חופש, שיבוצים והיעדרויות יומיים, וכן את ההיסטוריה של בית הספר — כדי
// שאפשר יהיה להתחיל שנה נקייה בלי לגרור נתונים משנה לשנה. הנתונים לא באמת נמחקים מה-DB (נשארים
// שם עם archived_at, ומוסתרים מהאפליקציה ע"י ה-RLS), אבל מבחינת המשתמשת זו פעולה שלא הופכים
// מתוך המסך — ראו RPC start_new_year. עדיין דורשת הקלדת מילת אישור מפורשת ולא רק "אישור/ביטול".
function NewYearSection({ schoolId, canEdit }: { schoolId: number | undefined; canEdit: boolean }) {
  const startNewYear = useStartNewYear()
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [resultError, setResultError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function openModal() {
    setConfirmText('')
    setResultError(null)
    setDone(false)
    setModalOpen(true)
  }

  async function handleConfirm() {
    if (!schoolId || confirmText !== NEW_YEAR_CONFIRM_TEXT) return
    setResultError(null)
    try {
      await startNewYear.mutateAsync(schoolId)
      setDone(true)
    } catch {
      setResultError('האיפוס נכשל. נסי שוב.')
    }
  }

  return (
    <div className="rounded-xl border border-danger/40 bg-panel p-[18px]">
      <div className="mb-1 text-[13px] font-bold text-danger">התחלת שנה חדשה</div>
      <div className="mb-3 text-[12px] text-ink-soft">
        מסתירה מהמערכת את נתוני השנה החולפת: תבנית השיבוץ השבועית, חופשות, קייטנות, ימי חופש,
        שיבוצים והיעדרויות יומיים, וההיסטוריה. רשימת העובדות, הכיתות, והגדרות בית הספר (תפקידים,
        קטגוריות וכו') לא נפגעות. הפעולה אינה ניתנת לביטול מתוך המסך.
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={openModal}
          className="rounded-lg border border-danger px-3 py-2 text-[13px] font-semibold text-danger transition-opacity hover:opacity-80"
        >
          התחלת שנה חדשה…
        </button>
      )}

      {!canEdit && (
        <div className="text-[11.5px] text-ink-soft">משתמשת בהרשאת צפייה בלבד — אין אפשרות לבצע פעולה זו.</div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            {done ? (
              <>
                <h2 className="mb-3 text-lg font-bold">בוצע</h2>
                <div className="mb-4 text-[13px] text-ink-soft">
                  נתוני השנה החולפת הוסתרו מהמערכת. אפשר להתחיל להגדיר את תבנית השיבוץ לשנה החדשה.
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  סגירה
                </button>
              </>
            ) : (
              <>
                <h2 className="mb-3 text-lg font-bold text-danger">התחלת שנה חדשה</h2>
                <div className="mb-4 text-[13px] leading-relaxed text-ink">
                  פעולה זו תסתיר מהמערכת את תבנית השיבוץ, חופשות, קייטנות, ימי חופש, שיבוצים
                  והיעדרויות יומיים, וההיסטוריה — לא ניתן לבטל מתוך המסך. כדי לאשר, הקלידי{' '}
                  <span className="font-bold">"{NEW_YEAR_CONFIRM_TEXT}"</span> בתיבה למטה.
                </div>
                <input
                  autoFocus
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-danger"
                />

                {resultError && (
                  <div className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
                    {resultError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirmText !== NEW_YEAR_CONFIRM_TEXT || startNewYear.isPending}
                    className="flex-1 rounded-lg bg-danger px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {startNewYear.isPending ? 'מבצעת…' : 'התחלת שנה חדשה'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// שם ושעות תצוגה לכל חלק-יום (בוקר/צהריים) — חלק-היום הטכני (morning/afternoon) עצמו קבוע
// במערכת; רק התווית והשעות המוצגות ניתנות להתאמה לכל בית ספר. לתצוגה בלבד, לא משפיע על
// לוגיקת השיבוץ.
function DayPartHoursSection({ schoolId, canEdit }: { schoolId: number | undefined; canEdit: boolean }) {
  const { data: settings, isLoading } = useSchoolSettings(schoolId)
  const updateSettings = useUpdateSchoolSettings()

  function save(field: 'morning_label' | 'morning_start' | 'morning_end' | 'afternoon_label' | 'afternoon_start' | 'afternoon_end', value: string) {
    if (!schoolId) return
    updateSettings.mutate({ schoolId, patch: { [field]: value || null } })
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-[18px]">
      <div className="mb-1 text-[13px] font-bold">שעות היום</div>
      <div className="mb-3 text-[12px] text-ink-soft">
        שם ושעות תצוגה לבוקר ולצהריים (למשל בוקר 08:00–13:00, צהריים 13:00–16:30). לתצוגה בלבד.
      </div>

      {isLoading || !settings ? (
        <div className="text-[12.5px] text-ink-soft">טוען…</div>
      ) : (
        <div className="flex flex-wrap gap-4 print:hidden">
          {(
            [
              { key: 'morning', label: settings.morning_label, start: settings.morning_start, end: settings.morning_end },
              { key: 'afternoon', label: settings.afternoon_label, start: settings.afternoon_start, end: settings.afternoon_end },
            ] as const
          ).map((part) => (
            <div key={part.key} className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-[12px] text-ink-soft">שם</span>
                <input
                  defaultValue={part.label}
                  disabled={!canEdit}
                  onBlur={(e) => save(`${part.key}_label`, e.target.value.trim())}
                  className="w-24 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] text-ink-soft">התחלה</span>
                <input
                  type="time"
                  defaultValue={part.start ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) => save(`${part.key}_start`, e.target.value)}
                  className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] text-ink-soft">סיום</span>
                <input
                  type="time"
                  defaultValue={part.end ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) => save(`${part.key}_end`, e.target.value)}
                  className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent disabled:opacity-60"
                />
              </label>
            </div>
          ))}
        </div>
      )}

      {!canEdit && (
        <div className="mt-2 text-[11.5px] text-ink-soft">משתמשת בהרשאת צפייה בלבד — אין אפשרות לשנות הגדרה זו.</div>
      )}
    </div>
  )
}

const CRITICALITY_LABEL: Record<Criticality, string> = {
  critical: 'קריטי',
  normal: 'רגיל',
  not_required: 'לא נדרש',
}

// תפקידים (מורה/סייעת/בת שירות וכו') וכמות ברירת מחדל לכיתה חדשה, לכל חלק-יום — נצרך
// ב-create_class_with_default_schedule (RPC) וב"שחזור חורי ברירת מחדל" (BaseSchedule)
function RoleTypesSection({ schoolId, canEdit }: { schoolId: number | undefined; canEdit: boolean }) {
  const { data: roleTypes, isLoading } = useRoleTypesOverview(schoolId)
  const createRoleType = useCreateRoleType()
  const updateRoleType = useUpdateRoleType()
  const updateDefault = useUpdateRoleTypeDefault()
  const confirm = useConfirm()

  const { name, setName, formError, handleSubmit } = useNamedItemForm('יש להזין שם תפקיד', async (trimmed) => {
    if (!schoolId) return
    await createRoleType.mutateAsync({ schoolId, name: trimmed, sortOrder: (roleTypes?.length ?? 0) + 1 })
  })

  function renameRoleType(rt: RoleTypeWithDefaults, newName: string) {
    if (!schoolId) return
    const trimmed = newName.trim()
    if (!trimmed || trimmed === rt.name) return
    updateRoleType.mutate({ roleTypeId: rt.id, schoolId, name: trimmed })
  }

  async function toggleActive(rt: RoleTypeWithDefaults) {
    if (!schoolId) return
    const message = rt.active
      ? `להשבית את התפקיד "${rt.name}"? הוא לא ייכלל עוד בברירת המחדל ליצירת כיתה חדשה.`
      : `לשחזר את התפקיד "${rt.name}"?`
    if (!(await confirm(message))) return
    updateRoleType.mutate({ roleTypeId: rt.id, schoolId, active: !rt.active })
  }

  function setCount(rt: RoleTypeWithDefaults, dayPart: DayPart, count: number) {
    if (!schoolId) return
    updateDefault.mutate({ schoolId, roleTypeId: rt.id, dayPart, count: Math.max(0, count) })
  }

  function setCriticality(rt: RoleTypeWithDefaults, dayPart: DayPart, criticality: Criticality) {
    if (!schoolId) return
    updateDefault.mutate({ schoolId, roleTypeId: rt.id, dayPart, criticality })
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-[18px]">
      <div className="mb-1 text-[13px] font-bold">תפקידים וכמויות ברירת מחדל</div>
      <div className="mb-3 text-[12px] text-ink-soft">
        התפקידים וכמותם בבוקר/צהריים שבהם תיווצר תבנית השיבוץ הבסיסית עבור כיתה חדשה. "דחיפות"
        קובעת עד כמה קריטי לאייש את התפקיד הזה בשיבוץ היומי.
      </div>

      {canEdit && (
        <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-[12px] text-ink-soft">שם תפקיד</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={createRoleType.isPending}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {createRoleType.isPending ? 'מוסיפה…' : '+ הוספת תפקיד'}
          </button>
        </form>
      )}

      {formError && (
        <div className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{formError}</div>
      )}

      {isLoading ? (
        <div className="text-[12.5px] text-ink-soft">טוען…</div>
      ) : roleTypes && roleTypes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="text-[12px] text-ink-soft">
                <th className="py-1.5 text-start font-medium">תפקיד</th>
                <th className="py-1.5 text-center font-medium" colSpan={2}>בוקר</th>
                <th className="py-1.5 text-center font-medium" colSpan={2}>צהריים</th>
                <th className="py-1.5"></th>
              </tr>
              <tr className="text-[11px] text-ink-soft">
                <th className="font-normal"></th>
                <th className="pb-1.5 text-center font-normal">כמות</th>
                <th className="pb-1.5 text-center font-normal">דחיפות</th>
                <th className="pb-1.5 text-center font-normal">כמות</th>
                <th className="pb-1.5 text-center font-normal">דחיפות</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roleTypes.map((rt) => {
                const morning = rt.defaults.find((d) => d.day_part === 'morning')
                const afternoon = rt.defaults.find((d) => d.day_part === 'afternoon')
                const fadeClass = rt.active ? '' : 'opacity-50'
                return (
                  <tr key={rt.id} className="border-t border-line">
                    <td className={`py-1.5 ${fadeClass}`}>
                      <input
                        defaultValue={rt.name}
                        disabled={!canEdit}
                        onBlur={(e) => renameRoleType(rt, e.target.value)}
                        className="w-28 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] font-medium outline-none hover:border-line focus:border-accent focus:bg-white disabled:opacity-60"
                      />
                      {!rt.active && <span className="text-[11px] text-ink-soft"> (לא פעיל)</span>}
                    </td>
                    {(['morning', 'afternoon'] as const).flatMap((dayPart) => {
                      const def = dayPart === 'morning' ? morning : afternoon
                      if (!def)
                        return [
                          <td key={`${dayPart}-count`} className={fadeClass} />,
                          <td key={`${dayPart}-crit`} className={fadeClass} />,
                        ]
                      return [
                        <td key={`${dayPart}-count`} className={`py-1.5 ${fadeClass}`}>
                          <input
                            type="number"
                            min={0}
                            disabled={!canEdit}
                            value={def.count}
                            onChange={(e) => setCount(rt, dayPart, Number(e.target.value))}
                            className="mx-auto block w-14 rounded-lg border border-line bg-white px-2 py-1 text-center text-[13px] outline-none focus:border-accent disabled:opacity-60"
                          />
                        </td>,
                        <td key={`${dayPart}-crit`} className={`py-1.5 ${fadeClass}`}>
                          <select
                            disabled={!canEdit}
                            value={def.criticality}
                            onChange={(e) => setCriticality(rt, dayPart, e.target.value as Criticality)}
                            className="mx-auto block rounded-lg border border-line bg-white px-2 py-1 text-[12px] text-ink-soft outline-none focus:border-accent disabled:opacity-60"
                          >
                            {(Object.keys(CRITICALITY_LABEL) as Criticality[]).map((c) => (
                              <option key={c} value={c}>
                                {CRITICALITY_LABEL[c]}
                              </option>
                            ))}
                          </select>
                        </td>,
                      ]
                    })}
                    <td className="py-1.5 text-end">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => toggleActive(rt)}
                          title={rt.active ? 'השבתה' : 'שחזור'}
                          aria-label={rt.active ? 'השבתה' : 'שחזור'}
                          className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea]"
                        >
                          {rt.active ? <Trash2 size={14} /> : <RotateCcw size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-[12.5px] text-ink-soft">אין תפקידים מוגדרים עדיין.</div>
      )}
    </div>
  )
}

// קטגוריות עובדות חופשיות (למשל "צוות קבוע"/"צוות חיצוני") עם צבע לתצוגה — נצרכות במסך
// "רשימת עובדות" (שיוך לעובדת, סינון, ותצוגה עם הצבע בטבלה)
function CategoriesSection({ schoolId, canEdit }: { schoolId: number | undefined; canEdit: boolean }) {
  const { data: categories, isLoading } = useEmployeeCategoriesOverview(schoolId)
  const createCategory = useCreateEmployeeCategory()
  const updateCategory = useUpdateEmployeeCategory()
  const confirm = useConfirm()

  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(DEFAULT_CATEGORY_COLOR)

  const { name, setName, formError, handleSubmit } = useNamedItemForm('יש להזין שם קטגוריה', async (trimmed) => {
    if (!schoolId) return
    await createCategory.mutateAsync({
      schoolId,
      name: trimmed,
      color,
      sortOrder: (categories?.length ?? 0) + 1,
    })
    setColor(DEFAULT_CATEGORY_COLOR)
  })

  function startEdit(category: EmployeeCategoryRow) {
    setEditingId(category.id)
    setEditName(category.name)
    setEditColor(category.color)
  }

  function saveEdit(categoryId: number) {
    if (!schoolId) return
    const trimmed = editName.trim()
    if (!trimmed) return
    updateCategory.mutate({ categoryId, schoolId, name: trimmed, color: editColor })
    setEditingId(null)
  }

  async function toggleActive(category: EmployeeCategoryRow) {
    if (!schoolId) return
    const message = category.active
      ? `להשבית את הקטגוריה "${category.name}"? היא תוסר מרשימות הבחירה, עובדות ששויכו אליה יישארו משויכות.`
      : `לשחזר את הקטגוריה "${category.name}"?`
    if (!(await confirm(message))) return
    updateCategory.mutate({ categoryId: category.id, schoolId, active: !category.active })
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-[18px]">
      <div className="mb-1 text-[13px] font-bold">קטגוריות עובדות</div>
      <div className="mb-3 text-[12px] text-ink-soft">
        קטגוריה חופשית להגדרת קבוצת עובדות. מוצגת במסך רשימת עובדות.
    </div>

      {canEdit && (
        <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-[12px] text-ink-soft">שם קטגוריה</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: צוות חיצוני"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-ink-soft">צבע</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[38px] w-14 cursor-pointer rounded-lg border border-line bg-white p-1"
            />
          </label>
          <button
            type="submit"
            disabled={createCategory.isPending}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {createCategory.isPending ? 'מוסיפה…' : '+ הוספת קטגוריה'}
          </button>
        </form>
      )}

      {formError && (
        <div className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{formError}</div>
      )}

      {isLoading ? (
        <div className="text-[12.5px] text-ink-soft">טוען…</div>
      ) : categories && categories.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {categories.map((c) =>
            editingId === c.id ? (
              <li
                key={c.id}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-line px-3 py-2 text-[13px]"
              >
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-[140px] flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-[34px] w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
                />
                <button
                  type="button"
                  onClick={() => saveEdit(c.id)}
                  className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90"
                >
                  שמירה
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
              </li>
            ) : (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[13px]"
              >
                <div className={`flex items-center gap-2 ${c.active ? '' : 'opacity-50'}`}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="font-medium">{c.name}</span>
                  {!c.active && <span className="text-[11px] text-ink-soft">(לא פעילה)</span>}
                </div>
                {canEdit && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      title="עריכה"
                      aria-label="עריכה"
                      className={`rounded-md border border-line p-1.5 hover:bg-[#f2f0ea] ${c.active ? '' : 'opacity-50'}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      title={c.active ? 'השבתה' : 'שחזור'}
                      aria-label={c.active ? 'השבתה' : 'שחזור'}
                      className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea]"
                    >
                      {c.active ? <Trash2 size={14} /> : <RotateCcw size={14} />}
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      ) : (
        <div className="text-[12.5px] text-ink-soft">אין קטגוריות מוגדרות עדיין.</div>
      )}
    </div>
  )
}

type HolidayDayPartMode = 'full' | 'morning' | 'afternoon'

function holidayDayPartMode(h: { includes_morning: boolean; includes_afternoon: boolean }): HolidayDayPartMode {
  if (h.includes_morning) return 'morning'
  if (h.includes_afternoon) return 'afternoon'
  return 'full'
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
  const { data: settings } = useSchoolSettings(schoolId)
  const setHoliday = useSetHoliday()
  const removeHoliday = useRemoveHoliday()
  const confirm = useConfirm()

  const morningLabel = settings?.morning_label ?? 'בוקר'
  const afternoonLabel = settings?.afternoon_label ?? 'צהריים'

  const [showAddModal, setShowAddModal] = useState(false)
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const [dayPartMode, setDayPartMode] = useState<HolidayDayPartMode>('full')
  const [formError, setFormError] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  function openAddModal() {
    setDate('')
    setLabel('')
    setDayPartMode('full')
    setFormError(null)
    setShowAddModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!schoolId || !date) {
      setFormError('יש לבחור תאריך')
      return
    }
    try {
      await setHoliday.mutateAsync({
        schoolId,
        date,
        label: label.trim() || null,
        includesMorning: dayPartMode === 'morning',
        includesAfternoon: dayPartMode === 'afternoon',
      })
      setShowAddModal(false)
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
        תאריך שמסומן כיום חופש מלא מוצג כלא-פעיל בלוח הבקרה, ומוסתר לגמרי ממסך "שיבוץ מ"מ".
        לחלופין ניתן לסמן "יום קצר" — רק חלק-היום שלא פעיל באותו יום ({morningLabel}/
        {afternoonLabel}) יינטרל, וחלק-היום השני יישאר פעיל כרגיל.
      </div>

      {canEdit && (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            + הוספת יום חופש
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
          >
            ייבוא מקובץ
          </button>
        </div>
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
                {holidayDayPartMode(h) !== 'full' && (
                  <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                    יום קצר — {holidayDayPartMode(h) === 'morning' ? morningLabel : afternoonLabel} בלבד
                  </span>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(h.holiday_date, h.label)}
                  title="ביטול"
                  aria-label="ביטול"
                  className="rounded-md border border-line p-1.5 hover:bg-[#f2f0ea]"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[12.5px] text-ink-soft">אין ימי חופש מוגדרים.</div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-line bg-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold">הוספת יום חופש</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">תאריך</span>
                <input
                  autoFocus
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">תיאור (רשות)</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="למשל: ראש השנה"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-soft">סוג</span>
                <select
                  value={dayPartMode}
                  onChange={(e) => setDayPartMode(e.target.value as HolidayDayPartMode)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
                >
                  <option value="full">יום חופש מלא</option>
                  <option value="morning">יום קצר — {morningLabel} בלבד פעיל</option>
                  <option value="afternoon">יום קצר — {afternoonLabel} בלבד פעיל</option>
                </select>
              </label>

              {formError && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{formError}</div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={setHoliday.isPending}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {setHoliday.isPending ? 'שומרת…' : 'שמירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && schoolId && (
        <ImportHolidaysModal
          schoolId={schoolId}
          existingHolidays={holidays ?? []}
          morningLabel={morningLabel}
          afternoonLabel={afternoonLabel}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}
