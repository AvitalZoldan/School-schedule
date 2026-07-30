// עזרי תאריכים ל"לוח בקרה" — טווח יום/שבוע (5.2 באפיון). כל התאריכים מטופלים כ-local date
// (לא UTC) כדי למנוע החלקה של יום עקב אזור זמן.
import { HDate } from '@hebcal/hdate'

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// weekday במונחי המערכת: 1=ראשון .. 7=שבת (WEEKDAY_LABELS מכסה 1..6 בלבד, שבת לא בשימוש)
export function systemWeekday(d: Date): number {
  return d.getDay() + 1
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

// ראשון של אותו שבוע (שבוע לימודים: ראשון-שישי)
export function weekStart(d: Date): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

// כל ימי השבוע (ראשון-שישי) המכילים תאריך זה, כמחרוזות ISO
export function weekDates(d: Date): string[] {
  const start = weekStart(d)
  return Array.from({ length: 6 }, (_, i) => toISODate(addDays(start, i)))
}

// כל התאריכים (ISO) בטווח [start, end] כולל שני הקצוות — לשימוש בטווחי חופשה (3.7) וכדומה
export function datesInRange(start: string, end: string): string[] {
  const result: string[] = []
  let cursor = parseISODate(start)
  while (toISODate(cursor) <= end) {
    result.push(toISODate(cursor))
    cursor = addDays(cursor, 1)
  }
  return result
}

// תאריך עברי מלא (יום+חודש) בגימטריה עם גרשיים, למשל "י״ח אב" / "ב׳ אדר ב" — ממיר Date לועזי
// דרך @hebcal/hdate (ספריית חישוב לוח עברי מדויקת, כולל חודש מעובר), בלי ניקוד ובלי שנה.
export function toHebrewDateLabel(d: Date): string {
  return new HDate(d).renderGematriya(true, true)
}

// עמודות timestamp without time zone נשמרות ב-DB לפי UTC (הפרויקט על Supabase עם session
// timezone=UTC) ומוחזרות ללקוח בלי סיומת Z — יש להוסיף אותה במפורש לפני parsing, אחרת הדפדפן
// יפרש את המחרוזת כזמן מקומי ויציג שעה שגויה בהפרש אזור הזמן. לשימוש בלשונית "היסטוריה".
export function toLocalTimeLabel(utcTimestampWithoutTz: string): string {
  const iso = utcTimestampWithoutTz.endsWith('Z') ? utcTimestampWithoutTz : `${utcTimestampWithoutTz}Z`
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

// תאריך לועזי קצר, למשל "26.07.2026"
export function toGregorianDateLabel(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${d.getFullYear()}`
}

// תאריך לועזי קצר בלי שנה (יום.חודש), למשל "26.07" — לשימוש במצב "גם וגם" לצד התאריך העברי
function toGregorianDayMonthLabel(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}`
}

// העדפת תצוגת תאריכים ברמת בית-ספר (מסך "ניהול", ברירת מחדל עברי) — ראו school_settings.date_display
export type DateDisplayMode = 'hebrew' | 'gregorian' | 'both'

export function formatDisplayDate(d: Date, mode: DateDisplayMode): string {
  if (mode === 'gregorian') return toGregorianDateLabel(d)
  if (mode === 'both') return `${toHebrewDateLabel(d)} (${toGregorianDayMonthLabel(d)})`
  return toHebrewDateLabel(d)
}

