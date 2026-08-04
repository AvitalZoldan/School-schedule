// מנרמל מספר טלפון לתצוגה אחידה: מקף אחרי 3 הספרות הראשונות (למשל "0527445127" ← "052-7445127").
// גם משחזר "0" מוביל שאבד כשמספר נערך באקסל (עמודת טלפון מזוהה כמספר ומאבדת אפס מוביל,
// אלא אם התא הוגדר כטקסט מראש) — לפי תבנית מספרי טלפון ישראליים: נייד (9 ספרות שמתחילות
// ב-5) או קווי (8 ספרות שמתחילות בקידומת אזור נפוצה). לא מושלם (מספר בינלאומי לא ייפגע כי
// הוא לא תואם את התבנית), אבל מכסה את המקרה הנפוץ. מקף גם מונע מאקסל לחזור ולזהות את הערך
// כמספר בעריכה הבאה של הקובץ.
//
// נקודת כניסה יחידה: מופעל בשכבת ה-DB (useCreateEmployee/useUpdateEmployee/
// useBulkCreateEmployees ב-useEmployees.ts), כדי שהתוצאה תהיה אחידה בין הוספה ידנית
// והוספה מקובץ, בלי לשכפל את הלוגיקה בכל מסך שמזין טלפון.
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.trim()
  if (/^5\d{8}$/.test(digits)) digits = '0' + digits
  else if (/^[2-489]\d{6,7}$/.test(digits)) digits = '0' + digits
  if (!/^\d+$/.test(digits) || digits.length <= 3) return digits
  return `${digits.slice(0, 3)}-${digits.slice(3)}`
}
