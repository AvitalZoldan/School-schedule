import { useEffect, useState } from 'react'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useClasses } from '../hooks/useClasses'
import { useEmployees } from '../hooks/useEmployees'
import {
  useActiveTemplate,
  useApplyDraft,
  useCreateDraft,
  useDiscardDraft,
  useDraftTemplate,
  useTemplateSlots,
} from '../hooks/useSchedule'
import { useConfirm } from '../components/common/ConfirmProvider'
import { WeekGrid } from '../components/schedule/WeekGrid'

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
  const { data: draftTemplate, isLoading: draftLoading } = useDraftTemplate(classId, 'regular')
  const { data: draftSlots, isLoading: slotsLoading } = useTemplateSlots(draftTemplate?.id)

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
    if (
      !(await confirm({
        message: 'להחיל את הטיוטה? היא תחליף מיידית את השיבוץ הפעיל של הכיתה, ואי אפשר לבטל פעולה זו.',
        confirmLabel: 'החילי טיוטה',
      }))
    )
      return
    const className = classes?.find((c) => c.id === classId)?.name
    applyDraft.mutate(
      {
        draftTemplateId: draftTemplate.id,
        previousActiveTemplateId: activeTemplate?.id ?? null,
        classId,
        mode: 'regular',
      },
      {
        onSuccess: () => {
          setApplySuccessMessage(
            `הטיוטה הוחלה בהצלחה — השיבוץ הפעיל של כיתה ${className ?? ''} עודכן. הטיוטה אינה קיימת עוד.`,
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
        <h1 className="text-xl font-bold">טיוטת שיבוץ</h1>

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
            {activeTemplate ? 'צרי טיוטה מהשיבוץ הפעיל' : 'צרי טיוטה חדשה'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-warn-soft px-3 py-2 print:hidden">
            <div className="text-[12.5px] text-warn">
              עורכת טיוטה — השינויים כאן לא משפיעים על השיבוץ הפעיל עד ל"החלת טיוטה".
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleDiscard}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-[#f2f0ea] disabled:cursor-not-allowed disabled:opacity-50"
              >
                מחקי טיוטה
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleApply}
                className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                החילי טיוטה
              </button>
            </div>
          </div>

          {slotsLoading ? (
            <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
          ) : (
            <WeekGrid slots={draftSlots ?? []} employees={employees ?? []} templateId={draftTemplate.id} />
          )}
        </div>
      )}
    </div>
  )
}
