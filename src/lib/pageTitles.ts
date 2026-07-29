// מיפוי מסלול → כותרת עברית, לתפריט הצד (מקור אמת יחיד למניעת כפילות תוויות)
export const NAV_ITEMS = [
  { to: '/', label: 'דאשבורד', end: true },
  { to: '/base', label: 'שיבוץ צוות קבוע בכיתות' },
  { to: '/missing', label: 'שיבוץ מ"מ' },
  { to: '/employee', label: 'דוח לעובדת' },
  { to: '/camps', label: 'ניהול קייטנות' },
  { to: '/draft', label: 'טיוטת שיבוץ' },
  { to: '/opening', label: 'מערכת פתיחות' },
  { to: '/history', label: 'היסטוריה' },
] as const

export const MANAGEMENT_ITEMS = [
  { to: '/management', label: 'הגדרות' },
  { to: '/staff', label: 'רשימת עובדות' },
  { to: '/classes', label: 'כיתות' },
] as const
