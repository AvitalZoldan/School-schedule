import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCurrentSchoolId } from '../hooks/useSchool'
import { useClasses } from '../hooks/useClasses'
import { useEmployees } from '../hooks/useEmployees'
import {
  useActiveTemplate,
  useCleanupDuplicateSlots,
  useSeedDefaultSlots,
  useTemplateSlots,
  findDuplicateSlotGroups,
} from '../hooks/useSchedule'
import { WeekGrid } from '../components/schedule/WeekGrid'

export default function BaseSchedule() {
  const schoolId = useCurrentSchoolId()
  const location = useLocation()
  const { data: classes, isLoading: classesLoading } = useClasses(schoolId)
  const { data: employees } = useEmployees(schoolId)

  // כיתה יכולה להגיע דרך ניווט ממסך "כיתות" (state.classId, כפתור "פתחי שיבוץ בסיסי");
  // אם לא הועבר classId (למשל כניסה ישירה מהתפריט), נבחרת הכיתה הראשונה כברירת מחדל.
  const [classId, setClassId] = useState<number | undefined>(
    () => (location.state as { classId?: number } | null)?.classId,
  )

  // אם מגיעים שוב מ"כיתות" בזמן שכבר נמצאים בדף (הניווט לא מרנדר מחדש את הקומפוננטה),
  // נעדכן את הבחירה לפי ה-state העדכני.
  useEffect(() => {
    const stateClassId = (location.state as { classId?: number } | null)?.classId
    if (stateClassId && stateClassId !== classId) {
      setClassId(stateClassId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // ברירת מחדל: הכיתה הראשונה, ברגע שהרשימה נטענת (רק אם עדיין אין בחירה)
  useEffect(() => {
    if (!classId && classes && classes.length > 0) {
      setClassId(classes[0].id)
    }
  }, [classes, classId])

  const { data: template, isLoading: templateLoading } = useActiveTemplate(classId, 'regular')
  const { data: slots, isLoading: slotsLoading } = useTemplateSlots(template?.id)
  const seedDefaultSlots = useSeedDefaultSlots()
  const cleanupDuplicates = useCleanupDuplicateSlots()

  const selectedClass = classes?.find((c) => c.id === classId)

  // חורים כפולים (אותו weekday+day_part+role) בלתי-נראים כאן (WeekGrid מציג שורה אחת לכל
  // צירוף), אבל גורמים לחוסר-התאמה מול הדאשבורד — ראו findDuplicateSlotGroups
  const duplicateGroups = findDuplicateSlotGroups(slots ?? [])

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">

        <select
          className="rounded-lg border border-line bg-white px-3 py-2 text-[13px]"
          value={classId ?? ''}
          onChange={(e) => setClassId(Number(e.target.value))}
          disabled={classesLoading}
        >
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>
              כיתה {c.name}
            </option>
          ))}
        </select>
      </div>

      {templateLoading || slotsLoading ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">טוען…</div>
      ) : !template ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-ink-soft">
          לכיתה זו אין עדיין תבנית שיבוץ בסיסית פעילה.
        </div>
      ) : (slots ?? []).length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-[18px] text-center text-ink-soft">
          <div className="mb-3">לתבנית של כיתה זו אין חורים כרגע.</div>
          <button
            type="button"
            disabled={seedDefaultSlots.isPending}
            onClick={() =>
              seedDefaultSlots.mutate(
                { templateId: template.id },
                { onError: (error) => alert(`שחזור החורים נכשל: ${error.message}`) },
              )
            }
            className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            צרי חורי ברירת מחדל (מורה + 2 סייעות)
          </button>
        </div>
      ) : (
        <>
          {duplicateGroups.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-danger-soft px-3 py-2">
              <div className="text-[12.5px] text-danger">
                נמצאו {duplicateGroups.length} חורים כפולים בתבנית זו — הם לא נראים כאן, אבל עלולים
                לגרום לחוסר-התאמה מול הדאשבורד/שיבוץ מ"מ.
              </div>
              <button
                type="button"
                disabled={cleanupDuplicates.isPending}
                onClick={() =>
                  cleanupDuplicates.mutate(
                    { templateId: template.id, slots: slots ?? [] },
                    { onError: (error) => alert(`ניקוי הכפילויות נכשל: ${error.message}`) },
                  )
                }
                className="rounded-md bg-danger px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                נקי כפילויות
              </button>
            </div>
          )}
          <WeekGrid slots={slots ?? []} employees={employees ?? []} templateId={template.id} />
        </>
      )}
    </div>
  )
}
