// מפעילה את דיאלוג ההדפסה של הדפדפן על #print-area (ראו index.css) — במקום צילום DOM,
// כדי לקבל טקסט חד וכיווניות RTL תקינה בעברית (html2canvas לא מסתדר טוב עם RTL).
// שימו לב: @page לא קובע כיוון (portrait/landscape) בכוונה — קביעה מפורשת מסתירה את
// בורר ה"פריסה" המובנה בחלון ההדפסה של הדפדפן, ועדיף לתת לדפדפן לטפל בזה.
export function PdfDownloadButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title="הדפסה או שמירה כקובץ PDF (בחלון ההדפסה אפשר לבחור לאורך/לרוחב, ולבחור יעד 'שמירה כ-PDF')"
      className="rounded-lg border border-line px-3 py-2 text-[12.5px] text-ink-soft transition-colors hover:bg-[#f2f0ea]"
    >
      ⬇ הורדת PDF
    </button>
  )
}
