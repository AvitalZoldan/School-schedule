// פרסור/בנייה של CSV גנריים — נמנעים בכוונה מספריית xlsx חיצונית (יש לה חולשות אבטחה ידועות
// בלי תיקון זמין, וזה חמור במיוחד כשמפרסרים קובץ שהועלה ע"י משתמשת). CSV נפתח ונשמר היטב
// באקסל, ופרסור ידני של הפורמט הזה פשוט ומספיק לצרכי הייבוא/הייצוא כאן.

export function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function buildCsv(rows: string[][]): string {
  return rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// פרסור CSV תקני (RFC 4180): תאים מצוטטים יכולים להכיל פסיקים/שורות חדשות, וגרש כפול
// כפול (""‎) בתוך תא מצוטט הוא גרש בודד. מדלג על שורות ריקות (נפוץ בסוף קובץ).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  // BOM בתחילת קובץ (נפוץ בקבצי CSV שנשמרו מאקסל) — לא חלק מהתוכן
  const src = text.startsWith('﻿') ? text.slice(1) : text

  for (let i = 0; i < src.length; i++) {
    const char = src[i]
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\r') {
      // מטופל ע"י \n שאחריו, או מתעלמים אם עומד לבד
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  // תא/שורה אחרונים בלי \n סוגר בסוף הקובץ
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}
