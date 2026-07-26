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

// תאריך עברי מלא (יום+חודש) בגימטריה עם גרשיים, למשל "י״ח אב" / "ב׳ אדר ב" — ממיר Date לועזי
// דרך @hebcal/hdate (ספריית חישוב לוח עברי מדויקת, כולל חודש מעובר), בלי ניקוד ובלי שנה.
export function toHebrewDateLabel(d: Date): string {
  return new HDate(d).renderGematriya(true, true)
}

// תאריך לועזי קצר, למשל "26.07.2026"
export function toGregorianDateLabel(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${d.getFullYear()}`
}

