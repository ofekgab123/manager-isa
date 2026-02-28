# פריסת Manager ISA על Vercel

מדריך להרצת הפרויקט (Backend + Dashboard) על Vercel.

## דרישות מקדימות

1. חשבון [Vercel](https://vercel.com)
2. חשבון [Upstash](https://upstash.com) (חינם) – לאחסון נתונים ב-Redis

---

## שלב 1: יצירת מסד נתונים Redis ב-Upstash

1. היכנס ל-[Upstash Console](https://console.upstash.com)
2. צור מסד Redis חדש (Create Database)
3. בחר Region קרוב (למשל `eu-central-1`)
4. העתק את:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

## שלב 2: העלאת הפרויקט ל-Vercel

### אופציה א': דרך GitHub (מומלץ)

1. דחוף את הקוד ל-GitHub
2. היכנס ל-[Vercel Dashboard](https://vercel.com/dashboard)
3. **Add New** → **Project**
4. ייבא את ה-repository
5. הגדרות:
   - **Root Directory**: השאר ריק (שורש הפרויקט)
   - **Framework Preset**: Other
   - **Build Command**: `cd server && npm install && cd ../dashboard && npm install && npm run build`
   - **Output Directory**: `dashboard/dist`

6. **Environment Variables** – הוסף:
   - `UPSTASH_REDIS_REST_URL` = (מה-Upstash)
   - `UPSTASH_REDIS_REST_TOKEN` = (מה-Upstash)

7. **Deploy**

### אופציה ב': דרך Vercel CLI

```bash
# התקנת Vercel CLI (פעם אחת)
npm i -g vercel

# התחברות
vercel login

# פריסה
vercel
```

לפני הפריסה, הוסף את משתני הסביבה ב-Vercel Dashboard:
**Project → Settings → Environment Variables**

---

## שלב 3: בדיקה מקומית עם Vercel Dev

```bash
# התקנת תלויות
npm run install:all

# הרצה מקומית (מדמה את Vercel)
vercel dev
```

**חשוב:** `vercel dev` מריץ את ה-API כ-serverless. כדי שהנתונים יישמרו, הגדר `.env.local` עם משתני Upstash:

```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

---

## מבנה הפרויקט ב-Vercel

| נתיב        | תיאור                          |
|-------------|--------------------------------|
| `/`         | Dashboard (React/Vite)         |
| `/api/*`    | Backend (Express serverless)   |

ה-Dashboard משתמש ב-`/api` – ב-Vercel כל הבקשות ל-`/api/*` מנותבות ל-API.

---

## אחסון נתונים

- **פיתוח מקומי** (בלי Upstash): הנתונים נשמרים ב-`server/data/orders.json`
- **Vercel (פרודקשן)**: הנתונים נשמרים ב-Upstash Redis

בלי משתני Upstash ב-production, הנתונים לא יישמרו בין בקשות.

---

## פתרון בעיות

### "Failed to fetch" ב-Dashboard
- ודא ש-Upstash מוגדר ב-Environment Variables
- בדוק ב-Vercel → Deployments → Function Logs

### Build נכשל
- ודא ש-`npm run install:all` עובד מקומית
- בדוק את ה-Build Logs ב-Vercel

### נתונים לא נשמרים
- ודא ש-`UPSTASH_REDIS_REST_URL` ו-`UPSTASH_REDIS_REST_TOKEN` מוגדרים
- ודא שהם מוגדרים ל-**Production** (ולא רק Preview)
