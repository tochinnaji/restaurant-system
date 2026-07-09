# IRMS

IRMS is a QR-based restaurant management system built with an Express/MySQL backend and a React/Vite frontend. It supports customer ordering, kitchen/staff operations, manager and CEO dashboards, stock tracking, QR table links, preparation-time records, and Paystack payments.

## Stack

- Backend: Node.js, Express, MySQL
- Frontend: React, Vite, React Router
- Payments: Paystack
- UI: Vanilla CSS with Lucide icons

## Project Layout

```text
restaurant-system/
  backend/
    config/
    controllers/
    middleware/
    routes/
    utils/
    server.js
    .env.example
  frontend/
    public/brand/
    src/
    index.html
    vite.config.js
  database/
    schema.sql
```

## Local Setup

1. `cd restaurant-system/backend`
2. Run `npm install`
3. Copy `.env.example` to `.env` and set your MySQL, JWT, Paystack, and base URL values.
4. For a Vercel frontend build, set `VITE_API_BASE_URL` to your Railway backend URL and `VITE_APP_BASE_PATH` to `/`.
5. `cd ../frontend`
6. Run `npm install`
7. Import `database/schema.sql` into MySQL.

## Run the App

### Development

- Backend: `cd restaurant-system/backend && npm run dev`
- Frontend: `cd restaurant-system/frontend && npm run dev`

### Production

- Build frontend: `cd restaurant-system/frontend && npm run build`
- Start backend: `cd restaurant-system/backend && npm start`
- In production, Express serves the built frontend from `frontend/dist`.

## Main Routes

These are React routes served under `/frontend`:

- Customer ordering: `/frontend/customer`
- QR scan redirect: `/frontend/scan/:tableNumber/:token`
- Login: `/frontend/shared/login`
- Staff console: `/frontend/staff`
- Manager dashboard: `/frontend/manager`
- Menu management: `/frontend/manager/menu`
- Order management: `/frontend/manager/orders`
- Stock management: `/frontend/manager/stock`
- QR generator: `/frontend/manager/qr`
- Users: `/frontend/manager/users`

## API

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/users`

### Menu
- `GET /api/menu`
- `GET /api/menu/all`
- `POST /api/menu`
- `PUT /api/menu/:id`
- `DELETE /api/menu/:id`

### Orders
- `POST /api/orders`
- `GET /api/orders/:id`
- `GET /api/orders`
- `PUT /api/orders/:id/status`
- `GET /api/dashboard`
- `GET /api/prep-times`

### Payments
- `POST /api/payment/initialize`
- `GET /api/payment/verify`

### Messages
- `POST /api/messages`
- `GET /api/messages`
- `PUT /api/messages/:id/respond`
- `PUT /api/messages/:id/read`

### Stock
- `GET /api/stock`
- `POST /api/stock`
- `PUT /api/stock/:id`

### QR
- `POST /api/qr/generate`
- `GET /api/qr/tables`

## Default Logins

- Admin: `admin@restaurant.com` / `Admin@123`
- Manager: `manager@restaurant.com` / `Admin@123`
- CEO: `ceo@restaurant.com` / `Admin@123`
- Staff: `staff@restaurant.com` / `Admin@123`

## Deployment Notes

- `BASE_URL` or `PUBLIC_BASE_URL` should be set to the public host used by the QR links.
- If you deploy the frontend to Vercel, set the project root to `restaurant-system/frontend`, then add `VITE_API_BASE_URL` and `VITE_APP_BASE_PATH` in Vercel environment variables. Keep the backend on Railway or another Node host.
- Pushing to GitHub only triggers Vercel if the Vercel project is actually linked to this repo and auto-deploys are enabled.

## QR Links

Customers must open a valid link that contains both the table number and token. The manager QR generator now creates links like:

`/scan/T1/<token>` when the frontend is deployed at the site root, or `/frontend/scan/T1/<token>` when it is served by the Express backend.

That route redirects into the customer ordering page with the correct table context.