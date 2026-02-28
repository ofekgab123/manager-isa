# Manager ISA - מערכת ניהול הזמנות

מערכת ניהול מרכזית לכל ההזמנות של ISA Express.

## הרצה

### 1. הפעלת השרת (API)

```bash
cd manager-isa/server
npm install
npm run dev
```

השרת רץ על `http://localhost:3002`

### 2. הפעלת הדשבורד

```bash
cd manager-isa/dashboard
npm install
npm run dev
```

הדשבורד רץ על `http://localhost:5174`

### 3. הפעלת האתר הראשי

```bash
cd ..
npm run dev
```

האתר הראשי שולח ומקבל הזמנות מהשרת של Manager ISA.

## API

| Method | Endpoint | תיאור |
|--------|----------|------|
| GET | `/api/orders` | כל ההזמנות (תמיכה ב-query: status, type, createdBy) |
| GET | `/api/orders/stats` | פילוחים וסטטיסטיקות |
| GET | `/api/orders/:id` | הזמנה בודדת |
| POST | `/api/orders` | יצירת הזמנה |
| PATCH | `/api/orders/:id` | עדכון הזמנה |
| DELETE | `/api/orders/:id` | מחיקת הזמנה |

## מבנה נתונים - הזמנה

```json
{
  "id": "ORD-1234567890",
  "type": "send | pickup",
  "boxes": 2,
  "address": { "displayAddress": "...", "lat": 0, "lng": 0 },
  "status": "pending | recorded | boxes_requested | linewhel_scheduled | packed | ready_pickup | shipped",
  "createdAt": "2025-03-01T...",
  "customerPhone": "+972...",
  "scheduledFor": null,
  "assignedTo": null,
  "readyAction": "ready_for_box | pickup | null",
  "createdBy": "customer | customer_service"
}
```
# manager-isa
# manager-isa
# mangaer-isa
