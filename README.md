# מערך צוות — קליינט React

שלד פרויקט React + TypeScript + Vite + Tailwind, עם ניתוב מוכן ל-9 המסכים מהאפיון, ו-Supabase client מוכן לחיבור לסכימה.

## 1. הכנה חד-פעמית על המחשב

1. התקיני [Node.js](https://nodejs.org) (גרסה LTS, 20 ומעלה) — זה נותן לך גם את `npm`.
2. התקיני עורך קוד — מומלץ [VS Code](https://code.visualstudio.com).
3. פתחי את תיקיית הפרויקט הזו בעורך.

## 2. הרצה מקומית (פיתוח + בדיקה תוך כדי)

בטרמינל, בתוך תיקיית הפרויקט:

```bash
npm install        # מתקין את כל הספריות (פעם ראשונה, ואחרי כל שינוי בתלויות)
npm run dev         # מריץ שרת פיתוח מקומי
```

הטרמינל יציג כתובת כמו `http://localhost:5173` — פתחי אותה בדפדפן. כל שינוי בקוד מתעדכן בדפדפן אוטומטית (hot reload), בלי לרענן ידנית.

## 3. חיבור ל-Supabase

1. הריצי את `schema_shiboatz_tzevet.sql` בפרויקט Supabase שלך (SQL Editor).
2. ב-Supabase: Project Settings → API → מעתיקים את ה-`Project URL` וה-`anon public key`.
3. מעתיקות את `.env.example` לקובץ בשם `.env` (באותה תיקייה), וממלאות את שני הערכים:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. מפעילות מחדש את `npm run dev`.

**חשוב:** קובץ `.env` לא נכנס ל-git (מוגדר ב-`.gitignore`) — כל אחד שמריץ את הפרויקט מגדיר את שלו.

## 4. מבנה הפרויקט

```
src/
  lib/supabase.ts          # חיבור ל-Supabase
  components/layout/       # Sidebar + Layout (התפריט הצדדי)
  pages/                    # 9 מסכי המערכת (כרגע placeholder, נמלא בהדרגה)
  App.tsx                   # הגדרת כל הנתיבים
```

כל פריט בתפריט הצדדי (`Sidebar.tsx`) מנווט לנתיב תואם ב-`App.tsx`, שמרנדר את הדף המתאים מ-`pages/`.

## 5. העלאה לאוויר (Deploy)

הכי פשוט: **Vercel** (חינמי לפרויקטים כאלה).

1. פותחות חשבון GitHub (אם אין), ודוחפות את הפרויקט הזה ל-repository חדש.
2. נכנסות ל-[vercel.com](https://vercel.com), מתחברות עם GitHub, ובוחרות "Import Project" על ה-repo.
3. Vercel מזהה אוטומטית שזה פרויקט Vite — לא צריך לשנות הגדרות build.
4. לפני הפריסה הראשונה: בהגדרות הפרויקט ב-Vercel → Environment Variables, מוסיפות את `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` (אותם ערכים מה-`.env` המקומי).
5. לוחצות Deploy — מקבלות כתובת אינטרנט חיה. כל push עתידי ל-branch הראשי יעדכן את האתר אוטומטית.

## מה הלאה

הדפים ב-`src/pages/` הם כרגע שלדים ריקים. השלב הבא: מילוי מסך "שיבוץ בסיסי" עם `WeekGrid` שמתחבר לטבלאות `schedule_templates` / `template_slots`.
