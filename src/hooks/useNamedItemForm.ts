import { useState, type FormEvent } from 'react'

// שלד משותף לטופס "הוספת פריט בשם" (תפקיד/קטגוריה, ראו Management.tsx): שדה שם + שגיאת
// טופס + איפוס אחרי הצלחה. לוגיקה ספציפית לכל פריט (למשל צבע קטגוריה) נשארת אצל הקורא —
// אפשר לכלול אותה בתוך onSubmit עצמו, היא תרוץ ותתאפס יחד עם שם הפריט.
export function useNamedItemForm(emptyNameMessage: string, onSubmit: (trimmedName: string) => Promise<void>) {
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError(emptyNameMessage)
      return
    }
    try {
      await onSubmit(trimmed)
      setName('')
      setFormError(null)
    } catch {
      setFormError('השמירה נכשלה. נסי שוב.')
    }
  }

  return { name, setName, formError, handleSubmit }
}
