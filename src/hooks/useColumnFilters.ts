import { useCallback, useMemo, useState } from 'react'

// תשתית משותפת לסינון טבלאות ברמת עמודה (אייקון זכוכית מגדלת בכותרת, עם צ'קבוקסים לעמודות
// בעלות ערכים קבועים, טווח מספרי לעמודות מסוג מספר, ו/או טקסט חופשי) — משמש בכל טבלה
// מסוננת באפליקציה (עובדות, היסטוריה, פניות משתמשים וכו'), כדי שלוגיקת הסינון וה-state
// לא ישוכפלו בין המסכים.
export type ColumnFilterValue = { text: string; selected: string[]; min: string; max: string }

export type ColumnFilterApi = {
  value: ColumnFilterValue
  setText: (text: string) => void
  toggleOption: (optionValue: string) => void
  setMin: (min: string) => void
  setMax: (max: string) => void
  clear: () => void
  isActive: boolean
}

const EMPTY_FILTER: ColumnFilterValue = { text: '', selected: [], min: '', max: '' }

export function useColumnFilters<K extends string>(
  keys: readonly K[],
): { filters: Record<K, ColumnFilterApi>; isAnyActive: boolean; resetAll: () => void } {
  const [state, setState] = useState<Record<K, ColumnFilterValue>>(
    () => Object.fromEntries(keys.map((k) => [k, EMPTY_FILTER])) as Record<K, ColumnFilterValue>,
  )

  const setText = useCallback((key: K, text: string) => {
    setState((s) => ({ ...s, [key]: { ...s[key], text } }))
  }, [])

  const toggleOption = useCallback((key: K, optionValue: string) => {
    setState((s) => {
      const current = s[key]
      const selected = current.selected.includes(optionValue)
        ? current.selected.filter((v) => v !== optionValue)
        : [...current.selected, optionValue]
      return { ...s, [key]: { ...current, selected } }
    })
  }, [])

  const setMin = useCallback((key: K, min: string) => {
    setState((s) => ({ ...s, [key]: { ...s[key], min } }))
  }, [])

  const setMax = useCallback((key: K, max: string) => {
    setState((s) => ({ ...s, [key]: { ...s[key], max } }))
  }, [])

  const clear = useCallback((key: K) => {
    setState((s) => ({ ...s, [key]: EMPTY_FILTER }))
  }, [])

  const resetAll = useCallback(() => {
    setState(Object.fromEntries(keys.map((k) => [k, EMPTY_FILTER])) as Record<K, ColumnFilterValue>)
  }, [keys])

  const filters = useMemo(
    () =>
      Object.fromEntries(
        keys.map((k) => {
          const value = state[k]
          const api: ColumnFilterApi = {
            value,
            setText: (text) => setText(k, text),
            toggleOption: (optionValue) => toggleOption(k, optionValue),
            setMin: (min) => setMin(k, min),
            setMax: (max) => setMax(k, max),
            clear: () => clear(k),
            isActive:
              value.text.trim() !== '' || value.selected.length > 0 || value.min.trim() !== '' || value.max.trim() !== '',
          }
          return [k, api]
        }),
      ) as Record<K, ColumnFilterApi>,
    [keys, state, setText, toggleOption, setMin, setMax, clear],
  )

  const isAnyActive = keys.some((k) => filters[k].isActive)

  return { filters, isAnyActive, resetAll }
}

// מתאים עמודת ערך קבוע (למשל: המזהה/מפתח של תפקיד, קטגוריה, סטטוס...) לצ'קבוקסים שנבחרו.
// כשלא נבחר כלום — הכל עובר (אין הגבלה).
export function matchesOption(filter: ColumnFilterValue, optionValue: string): boolean {
  return filter.selected.length === 0 || filter.selected.includes(optionValue)
}

// מתאים עמודת טקסט חופשי (case-insensitive, substring). כשהשדה ריק — הכל עובר.
export function matchesText(filter: ColumnFilterValue, displayValue: string): boolean {
  const query = filter.text.trim().toLowerCase()
  return !query || displayValue.toLowerCase().includes(query)
}

// מתאים עמודת מספר לטווח מ-/עד שהוזן. כששני השדות ריקים — הכל עובר.
export function matchesNumberRange(filter: ColumnFilterValue, value: number): boolean {
  const min = filter.min.trim() === '' ? null : Number(filter.min)
  const max = filter.max.trim() === '' ? null : Number(filter.max)
  if (min !== null && !Number.isNaN(min) && value < min) return false
  if (max !== null && !Number.isNaN(max) && value > max) return false
  return true
}
