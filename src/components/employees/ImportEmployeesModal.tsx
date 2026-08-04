import { useMemo, useState } from 'react'
import { buildCsv, downloadCsv } from '../../lib/csv'
import { formatPhone } from '../../lib/phone'
import { useCsvImportFile } from '../../hooks/useCsvImportFile'
import { useBulkCreateEmployees } from '../../hooks/useEmployees'
import type { EmployeeFormInput } from '../../hooks/useEmployees'
import type { EmployeeStatus, EmployeeTypeRow } from '../../types/schedule'

const TEMPLATE_HEADERS = ['שם מלא', 'תפקיד בסיס', 'סטטוס (קבועה / מ"מ)', 'טלפון', 'מייל', 'הערות']

const STATUS_ALIASES: Record<string, EmployeeStatus> = {
  'קבועה': 'permanent',
  'מ"מ': 'substitute',
  'מ״מ': 'substitute',
  'ממ': 'substitute',
}

const STATUS_LABELS: Record<EmployeeStatus, string> = { permanent: 'קבועה', substitute: 'מ"מ' }

// תפקיד/סטטוס בטמפלט ממולאים כבר עם ברירת המחדל הנוכחית שנבחרה במודאל (בכל השורות, לא רק
// בדוגמה) — כדי שיהיה ברור באקסל מה ייכנס בפועל, אבל שתי העמודות ניתנות לשינוי פרטני
// לכל שורה, או להשארה ריקה ומילוי אחר כך במערכת עצמה דרך "עריכה"
export function buildEmployeesTemplateCsv(defaultTypeLabel: string, defaultStatus: EmployeeStatus): string {
  return buildCsv([
    TEMPLATE_HEADERS,
    [
      'ישראלה כהן',
      defaultTypeLabel,
      STATUS_LABELS[defaultStatus],
      '050-1234567',
      '',
      'שורת דוגמה — אפשר למחוק, לשנות, או להשאיר תפקיד/סטטוס ריקים',
    ],
  ])
}

interface ParsedRow {
  rowNumber: number
  full_name: string
  typeLabel: string
  statusLabel: string
  phone: string
  email: string
  notes: string
  errors: string[]
}

// שם עובדת נחשב כפילות מול עובדת קיימת (פעילה או לא) או מול שם אחר שכבר הופיע בקובץ עצמו —
// חוסם ייבוא של השורה, כדי למנוע יצירת שתי עובדות באותו שם בטעות (גורם לבעיות שיבוץ בהמשך)
function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function parseRows(
  dataRows: string[][],
  existingNames: Set<string>,
  employeeTypeByLabel: Map<string, EmployeeTypeRow>,
): ParsedRow[] {
  const namesSeenInFile = new Set<string>()
  return dataRows.map((cols, index) => {
    const [full_name = '', typeLabel = '', statusLabel = '', phone = '', email = '', notes = ''] = cols
    const errors: string[] = []
    const trimmedName = full_name.trim()
    const trimmedType = typeLabel.trim()
    const trimmedStatus = statusLabel.trim()

    if (!trimmedName) {
      errors.push('חסר שם מלא')
    } else {
      const normalized = normalizeName(trimmedName)
      if (existingNames.has(normalized) || namesSeenInFile.has(normalized)) {
        errors.push('כבר קיימת עובדת בשם זה — לא ייובא')
      }
      namesSeenInFile.add(normalized)
    }

    // תפקיד/סטטוס הם רשות — שגיאה רק אם מולא ערך שלא מזוהה, לא כשהתא ריק
    if (trimmedType && !employeeTypeByLabel.has(trimmedType)) {
      errors.push(`תפקיד "${trimmedType}" לא קיים`)
    }
    if (trimmedStatus && !STATUS_ALIASES[trimmedStatus]) {
      errors.push(`סטטוס "${trimmedStatus}" לא מזוהה (קבועה / מ"מ)`)
    }

    return {
      rowNumber: index + 2, // +2: שורה 1 היא הכותרת בקובץ
      full_name: trimmedName,
      typeLabel: trimmedType,
      statusLabel: trimmedStatus,
      phone: formatPhone(phone.trim()) ?? '',
      email: email.trim(),
      notes: notes.trim(),
      errors,
    }
  })
}

interface Props {
  schoolId: number
  employeeTypes: EmployeeTypeRow[]
  existingNames: string[]
  onClose: () => void
}

// ייבוא עובדות בכמות מקובץ CSV: הורדת טמפלט > מילוי באקסל > העלאה > תצוגה מקדימה עם
// אימות שורה-שורה > ייבוא השורות התקינות. תפקיד/סטטוס הם עמודות רשות בטמפלט עצמו (לא
// דורשות בחירה מראש) — תא ריק מקבל את ברירת המחדל של בית הספר (התפקיד הראשון הפעיל /
// "קבועה"), וניתן לתקן פרטנית אחר כך במסך "עריכה". פרסור עצמי (ראו lib/csv.ts) בלי
// ספריית xlsx חיצונית — נמנעים מלהכניס תלות עם חולשות אבטחה ידועות, במיוחד כשמפרסרים
// קובץ שהועלה ע"י משתמשת.
export function ImportEmployeesModal({ schoolId, employeeTypes, existingNames, onClose }: Props) {
  const [defaultTypeId, setDefaultTypeId] = useState<number>(employeeTypes[0]?.id ?? 0)
  const [defaultStatus, setDefaultStatus] = useState<EmployeeStatus>('permanent')

  const bulkCreate = useBulkCreateEmployees()
  const existingNamesSet = useMemo(() => new Set(existingNames.map(normalizeName)), [existingNames])
  const employeeTypeByLabel = useMemo(
    () => new Map(employeeTypes.map((t) => [t.label.trim(), t] as const)),
    [employeeTypes],
  )
  const fallbackTypeId = defaultTypeId || null
  const defaultTypeLabel = employeeTypes.find((t) => t.id === defaultTypeId)?.label ?? employeeTypes[0]?.label ?? 'מורה'

  const { fileInputRef, fileName, rows, parseError, resultMessage, setParseError, setResultMessage, handleFile, reset } =
    useCsvImportFile<ParsedRow>((dataRows) => parseRows(dataRows, existingNamesSet, employeeTypeByLabel))

  const validRows = (rows ?? []).filter((r) => r.errors.length === 0)
  const invalidCount = (rows ?? []).length - validRows.length

  async function handleImport() {
    if (validRows.length === 0 || !fallbackTypeId) return
    const payload: EmployeeFormInput[] = validRows.map((r) => ({
      full_name: r.full_name,
      employee_type_id: r.typeLabel ? employeeTypeByLabel.get(r.typeLabel)!.id : fallbackTypeId,
      status: r.statusLabel ? STATUS_ALIASES[r.statusLabel] : defaultStatus,
      category_id: null,
      phone: r.phone || null,
      email: r.email || null,
      notes: r.notes || null,
      is_preferred: false,
    }))
    try {
      await bulkCreate.mutateAsync({ schoolId, rows: payload })
      setResultMessage(`יובאו בהצלחה ${payload.length} עובדות.`)
      reset()
    } catch (error) {
      setParseError(`הייבוא נכשל: ${(error as Error).message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[85vh] w-full max-w-[720px] flex-col rounded-xl border border-line bg-panel p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-bold">ייבוא עובדות מקובץ</h2>
        <div className="mb-4 text-[12.5px] text-ink-soft">
          הורידי קובץ דוגמא, מלאי אותו באקסל (שם מלא חובה, שאר השדות לפי הצורך — תפקיד/סטטוס אפשר
          גם להשאיר ריקים ולמלא אחר כך במערכת), ואז העלי אותו כאן.
        </div>

        {!fallbackTypeId && (
          <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
            אין עדיין תפקידים מוגדרים בבית הספר — יש להגדיר תפקיד אחד לפחות (מסך "רשימת
            עובדות" ← טופס הוספת עובדת) לפני ייבוא מקובץ.
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-ink-soft">תפקיד ברירת מחדל</span>
            <select
              value={defaultTypeId}
              onChange={(e) => setDefaultTypeId(Number(e.target.value))}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
            >
              {employeeTypes.length === 0 && <option value={0}>אין תפקידים מוגדרים</option>}
              {employeeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-ink-soft">סטטוס ברירת מחדל</span>
            <select
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value as EmployeeStatus)}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
            >
              <option value="permanent">קבועה</option>
              <option value="substitute">מ"מ</option>
            </select>
          </label>
          <span className="pb-1.5 text-[11.5px] text-ink-soft">
            מוצג בקובץ הדוגמא המורד ומשמש כברירת מחדל לתאים ריקים — ניתן לשנות פרטנית בקובץ עצמו
          </span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCsv('קובץ דוגמא עובדות.csv', buildEmployeesTemplateCsv(defaultTypeLabel, defaultStatus))}
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
                    <th className="px-2 py-1.5 text-right">שם</th>
                    <th className="px-2 py-1.5 text-right">תפקיד</th>
                    <th className="px-2 py-1.5 text-right">סטטוס</th>
                    <th className="px-2 py-1.5 text-right">טלפון</th>
                    <th className="px-2 py-1.5 text-right">מייל</th>
                    <th className="px-2 py-1.5 text-right">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNumber} className={`border-t border-line ${r.errors.length > 0 ? 'bg-danger-soft/40' : ''}`}>
                      <td className="px-2 py-1.5">{r.rowNumber}</td>
                      <td className="px-2 py-1.5">
                        {r.full_name || '—'}
                        {r.errors.length > 0 && <div className="text-danger">{r.errors.join('; ')}</div>}
                      </td>
                      <td className="px-2 py-1.5 text-ink-soft">
                        {r.typeLabel || <span className="italic">ברירת מחדל: {defaultTypeLabel}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-ink-soft">
                        {r.statusLabel || <span className="italic">ברירת מחדל: {STATUS_LABELS[defaultStatus]}</span>}
                      </td>
                      <td className="px-2 py-1.5" dir="ltr">{r.phone || '—'}</td>
                      <td className="px-2 py-1.5" dir="ltr">{r.email || '—'}</td>
                      <td className="px-2 py-1.5">{r.notes || '—'}</td>
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
            disabled={validRows.length === 0 || !fallbackTypeId || bulkCreate.isPending}
            onClick={handleImport}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkCreate.isPending ? 'הוספה...' : `הוספת ${validRows.length} עובדות`}
          </button>
        </div>
      </div>
    </div>
  )
}
