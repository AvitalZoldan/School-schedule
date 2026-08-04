// מיפוי מסלול → כותרת עברית, לתפריט הצד (מקור אמת יחיד למניעת כפילות תוויות)
export const NAV_ITEMS = [
  { to: '/', label: 'דף הבית', end: true },
  { to: '/missing', label: 'שיבוץ מ"מ' },
  { to: '/draft', label: 'מערכת חלופית' },
  { to: '/opening', label: 'מערכות עזר' },

    { to: '/employee', label: 'דוח לעובדת' },
  { to: '/base', label: 'שיבוץ צוות קבוע בכיתות' },
  { to: '/camps', label: 'קייטנות' },
  { to: '/history', label: 'היסטוריה' },
] as const

export const MANAGEMENT_ITEMS = [
  { to: '/management', label: 'הגדרות' },
  { to: '/staff', label: 'עובדות' },
  { to: '/classes', label: 'כיתות' },
] as const
