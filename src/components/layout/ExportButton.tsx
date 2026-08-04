import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { downloadCsv, toCsvCell } from '../../lib/csv'

// אלמנט מוסתר כרגע במסך (display:none, כולל דרך אב מוסתר — למשל שורה שסוננה החוצה ע"י
// checkbox/חיפוש/בורר שמטמיע את הסינון ב-CSS ולא בהסרת ה-DOM). offsetParent הוא null בדיוק
// במקרה הזה, ולכן זו הדרך הפשוטה ביותר לוודא שהייצוא תואם למה שבאמת מוצג על המסך
function isVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null
}

// ממירה טבלת HTML בודדת ל-CSV (עמודות מופרדות בפסיק, תאים מצוטטים) — שומרת רק על טקסט,
// לא על עיצוב/צבעים (אלה לא ניתנים לייצוא ל-CSV ממילא), ומדלגת על שורות/תאים מוסתרים כרגע
// (למשל תוצאה שסוננה החוצה) כדי שהייצוא יתאים בדיוק למה שמוצג בפועל במסך.
// משתמשים ב-innerText ולא textContent: תא שבו שם התפקיד וחלק-היום מוצגים כשתי שורות נפרדות
// (למשל "מורה" / "בוקר" בכרטיס הכיתה בדאשבורד) הם שני <div> נפרדים בלי טקסט מפריד ביניהם —
// textContent היה מדביק אותם ל"מורהבוקר", בעוד innerText מכבד את שבירת השורה הוויזואלית.
//
// עמודת "פעולות" (עריכה/השבתה/הוספת חופשה וכו') לא מכילה נתונים — רק כפתורי פעולה של המסך —
// ולכן מדלגים על **כל** עמודה שיש בה תא עם <button> ולו בשורה אחת (כדי לא לשבש יישור עמודות,
// גם אם מספר הכפתורים בפועל משתנה בין שורה לשורה, למשל תלוי בסטטוס חופשה של כל עובדת)
function tableToCsv(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr')).filter(isVisible)
  const rowCells = rows.map((row) =>
    Array.from(row.querySelectorAll('th, td')).filter(
      (cell): cell is HTMLElement => cell instanceof HTMLElement && isVisible(cell),
    ),
  )

  const columnCount = Math.max(0, ...rowCells.map((cells) => cells.length))
  const buttonColumns = new Set<number>()
  for (let col = 0; col < columnCount; col++) {
    if (rowCells.some((cells) => cells[col]?.querySelector('button'))) buttonColumns.add(col)
  }

  return rowCells
    .map((cells) =>
      cells
        .filter((_, col) => !buttonColumns.has(col))
        .map((cell) => toCsvCell(cell.innerText.trim().replace(/\s+/g, ' ')))
        .join(','),
    )
    .join('\r\n')
}

// מייצאת את כל הטבלאות המוצגות כרגע במסך (בתוך #print-area) לקובץ CSV אחד, שנפתח היטב
// באקסל (כולל עברית — BOM ב-UTF-8 נדרש כדי שאקסל לא יציג ג'יבריש).
// חלק מהמסכים (למשל לוח הבקרה) עוטפים את כל התוכן ב-<table> חיצוני שמשמש רק לצורך פאגינציה
// בהדפסה (כדי ש-thead יחזור על עצמו בכל עמוד מודפס) — ומכיל בתוכו טבלאות "אמיתיות" נוספות.
// querySelectorAll('tr') על טבלה כזו "בולע" גם את השורות של הטבלאות המקוננות בתוכה, ומייצר
// שורה ענקית ולא מיושרת. לכן מייצאים רק טבלאות "עלה" — כאלה שאין בתוכן טבלה נוספת.
function downloadExcel() {
  const printArea = document.getElementById('print-area')
  const tables = printArea
    ? Array.from(printArea.querySelectorAll('table')).filter((t) => isVisible(t) && !t.querySelector('table'))
    : []
  const csvChunks = tables.map((t) => tableToCsv(t)).filter((chunk) => chunk.trim() !== '')
  if (csvChunks.length === 0) {
    alert('אין טבלה לייצוא במסך הזה')
    return
  }
  downloadCsv(`${document.title || 'ייצוא'}.csv`, csvChunks.join('\r\n\r\n'))
}

export function ExportButton() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-[12.5px] text-ink-soft transition-colors hover:bg-[#f2f0ea]"
      >
        ⬇ ייצוא
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute start-0 z-50 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              window.print()
            }}
            title="הדפסה או שמירה כקובץ PDF (בחלון ההדפסה אפשר לבחור לאורך/לרוחב, ולבחור יעד 'שמירה כ-PDF')"
            className="block w-full px-3 py-2 text-start text-[12.5px] text-ink hover:bg-[#f2f0ea]"
          >
            PDF (הדפסה)
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              downloadExcel()
            }}
            className="block w-full px-3 py-2 text-start text-[12.5px] text-ink hover:bg-[#f2f0ea]"
          >
            Excel
          </button>
        </div>
      )}
    </div>
  )
}
