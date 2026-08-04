import { useEffect, useMemo, useState } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useClasses } from '../hooks/useClasses'
import { useEmployees } from '../hooks/useEmployees'
import {
  useActiveTemplate,
  useApplyDraft,
  useCreateDraft,
  useDatedActiveTemplate,
  useDiscardDraft,
  useDraftTemplate,
  useTemplateSlots,
  useSchoolSlotsForConflictCheck,
} from '../hooks/useSchedule'
import { useConfirm } from '../components/common/ConfirmProvider'
import { WeekGrid } from '../components/schedule/WeekGrid'
import { SegmentedToggle } from '../components/common/SegmentedToggle'

export default function Draft() {
  const schoolId = useCurrentSchoolId()
  const confirm = useConfirm()
  const { data: classes, isLoading: classesLoading } = useClasses(schoolId)
  const { data: employees } = useEmployees(schoolId)

  const [classId, setClassId] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!classId && classes && classes.length > 0) {
      setClassId(classes[0].id)
    }
  }, [classes, classId])

  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null)

  const { data: activeTemplate, isLoading: activeLoading } = useActiveTemplate(classId, 'regular')
  const { data: datedActiveTemplate } = useDatedActiveTemplate(classId, 'regular')
  const { data: draftTemplate, isLoading: draftLoading } = useDraftTemplate(classId, 'regular')
  const { data: draftSlots, isLoading: slotsLoading } = useTemplateSlots(draftTemplate?.id)
  const { data: conflictSlots } = useSchoolSlotsForConflictCheck(schoolId, 'regular', 'draft')
  const classNameById = useMemo(() => new Map((classes ?? []).map((c) => [c.id, c.name])), [classes])

  const [applyMode, setApplyMode] = useState<'full' | 'dated'>('full')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [dateRangeError, setDateRangeError] = useState<string | null>(null)

  const createDraft = useCreateDraft()
  const discardDraft = useDiscardDraft()
  const applyDraft = useApplyDraft()

  async function handleDiscard() {
    if (!draftTemplate || !classId) return
    if (!(await confirm('למחוק את הטיוטה? כל השינויים בה יאבדו — השיבוץ הפעיל לא ישתנה.'))) return
    discardDraft.mutate(
      { draftTemplateId: draftTemplate.id, classId, mode: 'regular' },
      { onError: (error) => alert(`מחיקת הטיוטה נכשלה: ${error.message}`) },
    )
  }

  async function handleApply() {
    if (!draftTemplate || !classId) return
    setDateRangeError(null)

    const isDated = applyMode === 'dated'
    if (isDated) {
      if (!validFrom || !validTo) {
        setDateRangeError('יש למלא תאריך התחלה ותאריך סיום')
        return
      }
      if (validTo < validFrom) {
        setDateRangeError('תאריך הסיום חייב להיות אחרי תאריך ההתחלה')
        return
      }
    }

    const confirmMessage = isDated
      ? `להחיל את הטיוטה רק בטווח ${validFrom} עד ${validTo}? מחוץ לטווח הזה ימשיך להופיע השיבוץ הקבוע כרגיל.${
          datedActiveTemplate ? ' שימי לב: יש כבר טווח מתוארך פעיל לכיתה זו — הוא יוחלף בטווח החדש.' : ''
        }`
      : 'להחיל את הטיוטה? היא תחליף מיידית וללא הגבלת זמן את השיבוץ הפעיל של הכיתה, ואי אפשר לבטל פעולה זו.'
    if (!(await confirm({ message: confirmMessage, confirmLabel: 'החילי טיוטה' }))) return

    const className = classes?.find((c) => c.id === classId)?.name
    applyDraft.mutate(
      {
        draftTemplateId: draftTemplate.id,
        previousActiveTemplateId: activeTemplate?.id ?? null,
        previousDatedTemplateId: datedActiveTemplate?.id ?? null,
        classId,
        mode: 'regular',
        validFrom: isDated ? validFrom : undefined,
        validTo: isDated ? validTo : undefined,
      },
      {
        onSuccess: () => {
          setApplyMode('full')
          setValidFrom('')
          setValidTo('')
          setApplySuccessMessage(
            isDated
              ? `הטיוטה הוחלה בהצלחה — תופיע בשיבוץ של כיתה ${className ?? ''} בין ${validFrom} ל-${validTo} בלבד. הטיוטה אינה קיימת עוד.`
              : `הטיוטה הוחלה בהצלחה — השיבוץ הפעיל של כיתה ${className ?? ''} עודכן. הטיוטה אינה קיימת עוד.`,
          )
        },
        onError: (error) => alert(`החלת הטיוטה נכשלה: ${error.message}`),
      },
    )
  }

  const isBusy = createDraft.isPending || discardDraft.isPending || applyDraft.isPending
  const selectedClass = classes?.find((c) => c.id === classId)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">מערכת חלופית</h1>

        <select
          className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] print:hidden"
          value={classId ?? ''}
          onChange={(e) => {
            setClassId(Number(e.target.value))
            setApplySuccessMessage(null)
          }}
          disabled={classesLoading}
        >
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>
              כיתה {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* בהדפסה מוסתר בורר הכיתה שבתפריט למעלה — כותרת זו שומרת על ההקשר "איזו כיתה" בעמוד המודפס */}
      {selectedClass && <div className="mb-3 hidden text-[13px] font-bold print:block">כיתה {selectedClass.name}</div>}

      {applySuccessMessage && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-line bg-ok-soft px-3 py-2 text-[12.5px] text-ok print:hidden">
          <span>{applySuccessMessage}</span>
          <button
            type="button"
            onClick={() => setApplySuccessMessage(null)}
            className="shrink-0 rounded px-1 text-[13px] leading-none hover:opacity-60"
            aria-label="סגירה"
          >
            ✕
          </button>
        </div>
      )}

      {activeLoading || draftLoading ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
      ) : !draftTemplate ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-center text-ink-soft">
          <div className="mb-3">אין כרגע טיוטה לכיתה זו.</div>
          <button
            type="button"
            disabled={!classId || isBusy}
            onClick={() => {
              if (!classId || !schoolId) return
              setApplySuccessMessage(null)
              createDraft.mutate(
                {
                  schoolId,
                  classId,
                  mode: 'regular',
                  sourceTemplateId: activeTemplate?.id ?? null,
                },
                { onError: (error) => alert(`יצירת הטיוטה נכשלה: ${error.message}`) },
              )
            }}
            className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activeTemplate ? 'יצירת טיוטה מהשיבוץ הפעיל' : 'יצירת טיוטה חדשה'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-warn-soft px-3 py-2 print:hidden">
            <div className="text-[12.5px] text-warn">
              עריכת טיוטה — השינויים כאן לא משפיעים על השיבוץ הפעיל עד ל"החלת טיוטה".
            </div>

            {datedActiveTemplate && (
              <div className="text-[12px] text-ink-soft">
                לכיתה זו כבר יש טווח תאריכים פעיל: {datedActiveTemplate.valid_from} עד{' '}
                {datedActiveTemplate.valid_to}. החלה עם תאריכים חדשים תחליף אותו.
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="block">
                <span className="mb-1 block text-[11.5px] text-ink-soft">סוג ההחלה</span>
                <SegmentedToggle
                  value={applyMode}
                  onChange={(v) => {
                    setApplyMode(v)
                    setDateRangeError(null)
                  }}
                  options={[
                    { value: 'full', label: 'החלפה מלאה' },
                    { value: 'dated', label: 'טווח תאריכים מוגבל' },
                  ]}
                />
              </div>

              {applyMode === 'dated' && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-ink-soft">תאריך התחלה</span>
                    <input
                      type="date"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-ink-soft">תאריך סיום</span>
                    <input
                      type="date"
                      value={validTo}
                      onChange={(e) => setValidTo(e.target.value)}
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
                    />
                  </label>
                </>
              )}

              <div className="mr-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleDiscard}
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-[#f2f0ea] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  מחיקת טיוטה
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleApply}
                  className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                 החלפת מערכת
                </button>
              </div>
            </div>

            {dateRangeError && <div className="text-[12px] text-danger">{dateRangeError}</div>}
          </div>

          {slotsLoading ? (
            <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
          ) : (
            <WeekGrid
              slots={draftSlots ?? []}
              employees={employees ?? []}
              templateId={draftTemplate.id}
              conflictSlots={conflictSlots}
              classNameById={classNameById}
            />
          )}
        </div>
      )}
    </div>
  )
}
