import { useMemo } from 'react'
import { buildCsv, downloadCsv } from '../../lib/csv'
import { toISODate } from '../../lib/dateUtils'
import { useCsvImportFile } from '../../hooks/useCsvImportFile'
import { useBulkSetHolidays, type HolidayRow } from '../../hooks/useHolidays'

const TEMPLATE_HEADERS = ['תאריך', 'תיאור', 'סוג']

export function buildHolidaysTemplateCsv(morningLabel: string, afternoonLabel: string): string {
  return buildCsv([
    TEMPLATE_HEADERS,
    [
      '01/09/2026',
      'שורת דוגמה — אפשר למחוק או לשנות. פורמט תאריך: יום/חודש/שנה',
      `מלא / ${morningLabel} / ${afternoonLabel} (ריק = יום מלא)`,
    ],
  ])
}

// מקבל גם dd/mm/yyyy (הפורמט הנפוץ באקסל בעברית) וגם yyyy-mm-dd (ISO) — כדי לא להכריח
// פורמט תאריך ספציפי בקובץ המיובא
function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return toISODateParts(Number(y), Number(m), Number(d))
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return toISODateParts(Number(y), Number(m), Number(d))
  }
  return null
}

function toISODateParts(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return toISODate(date)
}

interface ParsedRow {
  rowNumber: number
  rawDate: string
  date: string | null
  label: string
  rawKind: string
  includesMorning: boolean
  includesAfternoon: boolean
  errors: string[]
}

// עמודת "סוג" קובעת אם זה יום חופש מלא (ריק, או "מלא") או "יום קצר" — ריק/"מלא" מבטל את שני
// חלקי-היום, ערך שתואם לתווית הבוקר/צהריים המוגדרת בבית הספר (למשל "בוקר"/"צהריים") מבטל רק
// את חלק-היום השני ומשאיר את זה שצוין פעיל
function parseKind(
  raw: string,
  morningLabel: string,
  afternoonLabel: string,
): { includesMorning: boolean; includesAfternoon: boolean; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === 'מלא' || trimmed === 'יום מלא' || trimmed === 'יום חופש מלא') {
    return { includesMorning: false, includesAfternoon: false, error: null }
  }
  if (trimmed === morningLabel || trimmed === 'בוקר') {
    return { includesMorning: true, includesAfternoon: false, error: null }
  }
  if (trimmed === afternoonLabel || trimmed === 'צהריים') {
    return { includesMorning: false, includesAfternoon: true, error: null }
  }
  return {
    includesMorning: false,
    includesAfternoon: false,
    error: `סוג "${trimmed}" לא מזוהה (מלא / ${morningLabel} / ${afternoonLabel})`,
  }
}

// תאריך שכבר קיים כיום חופש (existingDates) לא נחסם — upsert מעדכן את השורה, ולא נחשב שגיאה.
// רק תאריך כפול בתוך הקובץ עצמו נחסם, כדי לא לייבא שתי שורות סותרות לאותו תאריך.
function parseRows(dataRows: string[][], morningLabel: string, afternoonLabel: string): ParsedRow[] {
  const datesSeenInFile = new Set<string>()
  return dataRows.map((cols, index) => {
    const [rawDate = '', label = '', rawKind = ''] = cols
    const errors: string[] = []
    const date = parseFlexibleDate(rawDate)
    const kind = parseKind(rawKind, morningLabel, afternoonLabel)

    if (!rawDate.trim()) {
      errors.push('חסר תאריך')
    } else if (!date) {
      errors.push('תאריך לא תקין (פורמט: יום/חודש/שנה)')
    } else if (datesSeenInFile.has(date)) {
      errors.push('תאריך כפול בקובץ — לא ייובא')
    } else {
      datesSeenInFile.add(date)
    }
    if (kind.error) errors.push(kind.error)

    return {
      rowNumber: index + 2,
      rawDate: rawDate.trim(),
      date,
      label: label.trim(),
      rawKind: rawKind.trim(),
      includesMorning: kind.includesMorning,
      includesAfternoon: kind.includesAfternoon,
      errors,
    }
  })
}

interface Props {
  schoolId: number
  existingHolidays: HolidayRow[]
  morningLabel: string
  afternoonLabel: string
  onClose: () => void
}

// ייבוא ימי חופש בכמות מקובץ CSV: הורדת טמפלט > מילוי באקסל (תאריך + תיאור + סוג) > העלאה
// > תצוגה מקדימה עם אימות שורה-שורה > ייבוא השורות התקינות. תאריך שכבר קיים כיום חופש
// מתעדכן (upsert לפי school_id+holiday_date) ולא נחסם. פרסור עצמי (ראו lib/csv.ts) בלי
// ספריית xlsx חיצונית — כמו ImportEmployeesModal.
export function ImportHolidaysModal({ schoolId, existingHolidays, morningLabel, afternoonLabel, onClose }: Props) {
  const bulkSetHolidays = useBulkSetHolidays()
  const existingDatesSet = useMemo(
    () => new Set(existingHolidays.map((h) => h.holiday_date)),
    [existingHolidays],
  )

  const { fileInputRef, fileName, rows, parseError, resultMessage, setParseError, setResultMessage, handleFile, reset } =
    useCsvImportFile<ParsedRow>((dataRows) => parseRows(dataRows, morningLabel, afternoonLabel))

  const validRows = (rows ?? []).filter((r) => r.errors.length === 0)
  const invalidCount = (rows ?? []).length - validRows.length

  async function handleImport() {
    if (validRows.length === 0) return
    const payload = validRows.map((r) => ({
      date: r.date!,
      label: r.label || null,
      includesMorning: r.includesMorning,
      includesAfternoon: r.includesAfternoon,
    }))
    try {
      await bulkSetHolidays.mutateAsync({ schoolId, rows: payload })
      setResultMessage(`יובאו בהצלחה ${payload.length} ימי חופש.`)
      reset()
    } catch (error) {
      setParseError(`הייבוא נכשל: ${(error as Error).message}`)
    }
  }

  function kindLabel(r: ParsedRow): string {
    if (r.includesMorning) return `יום קצר — ${morningLabel} בלבד`
    if (r.includesAfternoon) return `יום קצר — ${afternoonLabel} בלבד`
    return 'יום מלא'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[85vh] w-full max-w-[620px] flex-col rounded-xl border border-line bg-panel p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-bold">ייבוא ימי חופש מקובץ</h2>
        <div className="mb-4 text-[12.5px] text-ink-soft">
          הורידי קובץ דוגמא, מלאי אותו באקסל ואז העלי אותו לכאן.
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCsv('קובץ דוגמא ימי חופש.csv', buildHolidaysTemplateCsv(morningLabel, afternoonLabel))}
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
          >
            ⬇ הורדת קובץ דוגמא
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
          >
            {fileName ? `קובץ נבחר: ${fileName}` : '+ העלאת קובץ'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>

        {parseError && (
          <div className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{parseError}</div>
        )}
        {resultMessage && (
          <div className="mb-3 rounded-lg bg-ok-soft px-3 py-2 text-[13px] text-ok">{resultMessage}</div>
        )}

        {rows && rows.length > 0 && (
          <>
            <div className="mb-2 text-[12.5px] text-ink-soft">
              {validRows.length} שורות תקינות
              {invalidCount > 0 ? `, ${invalidCount} שורות עם שגיאות (לא יתווספו)` : ''}
            </div>
            <div className="mb-4 flex-1 overflow-auto rounded-lg border border-line">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-[#f2f0ea] text-ink-soft">
                    <th className="px-2 py-1.5 text-right">שורה</th>
                    <th className="px-2 py-1.5 text-right">תאריך</th>
                    <th className="px-2 py-1.5 text-right">תיאור</th>
                    <th className="px-2 py-1.5 text-right">סוג</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNumber} className={`border-t border-line ${r.errors.length > 0 ? 'bg-danger-soft/40' : ''}`}>
                      <td className="px-2 py-1.5">{r.rowNumber}</td>
                      <td className="px-2 py-1.5">
                        {r.rawDate || '—'}
                        {r.errors.length > 0 && <div className="text-danger">{r.errors.join('; ')}</div>}
                        {r.date && existingDatesSet.has(r.date) && (
                          <div className="italic text-ink-soft">יעדכן יום חופש קיים</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">{r.label || '—'}</td>
                      <td className="px-2 py-1.5 text-ink-soft">{kindLabel(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-[#f2f0ea]"
          >
            סגירה
          </button>
          <button
            type="button"
            disabled={validRows.length === 0 || bulkSetHolidays.isPending}
            onClick={handleImport}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkSetHolidays.isPending ? 'הוספה...' : `הוספת ${validRows.length} ימי חופש`}
          </button>
        </div>
      </div>
    </div>
  )
}
