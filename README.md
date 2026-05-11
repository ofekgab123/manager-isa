# Manager ISA — Order management system

Central management system for all ISA Express orders.

## Running locally

### 1. API server

```bash
cd server
npm install
npm run dev
```

The API runs at `http://localhost:3002`

### 2. Dashboard

```bash
cd dashboard
npm install
npm run dev
```

The dashboard runs at `http://localhost:5174`

### 3. API + dashboard together

From the repository root (if you ended in `dashboard`, run `cd ..` first):

```bash
npm run dev
```

This runs the API and the dashboard concurrently (see the root `package.json` `dev` script).

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | All orders (query params: `status`, `type`, `createdBy`) |
| GET | `/api/orders/stats` | Breakdowns and statistics |
| GET | `/api/orders/:id` | Single order |
| POST | `/api/orders` | Create order |
| PATCH | `/api/orders/:id` | Update order |
| DELETE | `/api/orders/:id` | Delete order |

## Order object shape

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
