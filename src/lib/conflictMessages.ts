// ניסוח אחיד לכל מקום במערכת שבו עובדת שכבר משובצת במקום אחר נבחרת גם כאן — כדי שהתנהגות
// "העברה" (ביטול השיבוץ הישן + שיבוץ כאן) תיראה ותתנסח באותה צורה בכל מסך (דאשבורד, שיבוץ
// בסיסי/טיוטה, חופשות, מערכת פתיחות).
export function buildTransferConfirmMessage(employeeName: string, whereText: string): string {
  return `${employeeName} כבר משובצת ${whereText}. האם להעביר אותה לכאן? השיבוץ הקיים שם יבוטל.`
}
