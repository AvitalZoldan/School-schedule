import { useState, type FormEvent } from 'react'
import { useCreateCamp, useUpdateCamp, type CampPeriodInput } from '../../hooks/useCamps'
import type { CampWithPeriods } from '../../types/camps'
import { toISODate } from '../../lib/dateUtils'

interface Props {
  schoolId: number
  existingCamp?: CampWithPeriods
  onClose: () => void
}

function emptyPeriod(): CampPeriodInput {
  const today = toISODate(new Date())
  return { startDate: today, endDate: today, includesMorning: true, includesAfternoon: true }
}

// טופס יצירה/עריכה של קייטנה (3.10 באפיון): שם + טווח/י תאריכים, כשלכל טווח אפשר להגדיר
// אם הוא כולל בוקר/צהריים/שניהם (קייטנה יכולה להיות מורכבת מכמה טווחים שונים בהגדרתם).
// אין אפשרות מחיקה — רק עריכה חוזרת (מתבצעת דרך אותו טופס, עם existingCamp).
export function CampFormModal({ schoolId, existingCamp, onClose }: Props) {
  const [name, setName] = useState(existingCamp?.name ?? '')
  const [periods, setPeriods] = useState<CampPeriodInput[]>(() =>
    existingCamp && existingCamp.camp_periods.length > 0
      ? existingCamp.camp_periods.map((p) => ({
          startDate: p.start_date,
          endDate: p.end_date,
          includesMorning: p.includes_morning,
          includesAfternoon: p.includes_afternoon,
        }))
      : [emptyPeriod()],
  )
  const [formError, setFormError] = useState<string | null>(null)

  const createCamp = useCreateCamp()
  const updateCamp = useUpdateCamp()
  const isSaving = createCamp.isPending || updateCamp.isPending

  function updatePeriod(index: number, patch: Partial<CampPeriodInput>) {
    setPeriods((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function addPeriod() {
    setPeriods((prev) => [...prev, emptyPeriod()])
  }

  function removePeriod(index: number) {
    setPeriods((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('יש להזין שם קייטנה')
      return
    }
    for (const p of periods) {
      if (p.endDate < p.startDate) {
        setFormError('בכל טווח, תאריך הסיום חייב להיות אחרי תאריך ההתחלה')
        return
      }
      if (!p.includesMorning && !p.includesAfternoon) {
        setFormError('בכל טווח יש לבחור לפחות בוקר או צהריים')
        return
      }
    }

    try {
      if (existingCamp) {
        await updateCamp.mutateAsync({ campId: existingCamp.id, schoolId, name: trimmedName, periods })
      } else {
        await createCamp.mutateAsync({ schoolId, name: trimmedName, periods })
      }
      onClose()
    } catch {
      setFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
      <div className="flex max-h-full w-full max-w-[560px] flex-col rounded-xl border border-line bg-panel p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold">{existingCamp ? 'עריכת קייטנה' : 'קייטנה חדשה'}</h2>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <label className="block">
            <span className="mb-1 block text-[13px] text-ink-soft">שם קייטנה</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='לדוגמה: קיץ תשפ"ז'
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-accent"
            />
          </label>

          <div>
            <div className="mb-1.5 text-[13px] font-semibold">טווחי תאריכים</div>
            <div className="flex flex-col gap-2">
              {periods.map((period, index) => (
                <div key={index} className="rounded-md border border-line px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <label className="flex-1">
                      <span className="mb-1 block text-[11.5px] text-ink-soft">התחלה</span>
                      <input
                        type="date"
                        value={period.startDate}
                        onChange={(e) => updatePeriod(index, { startDate: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] outline-none focus:border-accent"
                      />
                    </label>
                    <label className="flex-1">
                      <span className="mb-1 block text-[11.5px] text-ink-soft">סיום</span>
                      <input
                        type="date"
                        value={period.endDate}
                        min={period.startDate}
                        onChange={(e) => updatePeriod(index, { endDate: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] outline-none focus:border-accent"
                      />
                    </label>
                    {periods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePeriod(index)}
                        className="mt-4 shrink-0 text-[11px] text-danger hover:opacity-70"
                      >
                        הסרה
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[12.5px]">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={period.includesMorning}
                        onChange={(e) => updatePeriod(index, { includesMorning: e.target.checked })}
                      />
                      בוקר
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={period.includesAfternoon}
                        onChange={(e) => updatePeriod(index, { includesAfternoon: e.target.checked })}
                      />
                      צהריים
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addPeriod}
              className="mt-2 rounded-md border border-line px-2.5 py-1 text-[12px] hover:bg-[#f2f0ea]"
            >
              + הוספת טווח נוסף
            </button>
          </div>

          {formError && (
            <div className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{formError}</div>
          )}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isSaving ? 'שומרת…' : 'שמירה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
