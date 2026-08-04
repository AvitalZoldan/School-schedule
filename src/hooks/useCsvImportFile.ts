import { useRef, useState } from 'react'
import { parseCsv } from '../lib/csv'

// שלד משותף לייבוא CSV: העלאת קובץ > פרסור (lib/csv) > שורות מפוענחות, עם מצב משותף
// (שם קובץ, שגיאת פרסור, הודעת תוצאה) — ראו ImportEmployeesModal/ImportHolidaysModal
export function useCsvImportFile<Row>(parseRows: (dataRows: string[][]) => Row[]) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  function handleFile(file: File) {
    setParseError(null)
    setResultMessage(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const table = parseCsv(text)
      if (table.length === 0) {
        setParseError('הקובץ ריק')
        setRows(null)
        return
      }
      const dataRows = table.slice(1) // מדלגים על שורת הכותרת
      setRows(parseRows(dataRows))
    }
    reader.onerror = () => setParseError('קריאת הקובץ נכשלה')
    reader.readAsText(file, 'utf-8')
  }

  function reset() {
    setRows(null)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return {
    fileInputRef,
    fileName,
    rows,
    parseError,
    resultMessage,
    setParseError,
    setResultMessage,
    handleFile,
    reset,
  }
}
