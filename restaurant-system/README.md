# Intelligent Restaurant Management System

An Express and MySQL restaurant management app with QR-based ordering, menu management, stock tracking, kitchen messaging, dashboards, and Paystack payment support.

## Project Structure

```text
restaurant-system/
  backend/
    config/db.js
    controllers/
    middleware/auth.js
    routes/index.js
    utils/waitTime.js
    server.js
    package.json
    .env.example
  frontend/
    customer/
    staff/
    manager/
    shared/
  database/
    schema.sql
```

## Setup

1. `cd restaurant-system`
2. Import `database/schema.sql` into MySQL.
3. `cd backend && npm install`
4. Copy `backend/.env.example` to `.env` and set your database, JWT, Paystack, and base URL values.
5. Start the server with `npm run dev` for development or `npm start` for production.

## Pages

- Customer ordering: `/frontend/customer/index.html?table=T1&token=...`
- Staff login: `/frontend/shared/login.html`
- Kitchen dashboard: `/frontend/staff/index.html`
- Manager dashboard: `/frontend/manager/index.html`
- Menu management: `/frontend/manager/menu.html`
- Order list: `/frontend/manager/orders.html`
- Stock management: `/frontend/manager/stock.html`
- QR code generator: `/frontend/manager/qr.html`

## API

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`

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

### QR Codes
- `POST /api/qr/generate`
- `GET /api/qr/tables`

## Default Login

- Admin: `admin@restaurant.com` / `Admin@123`
- Manager: `manager@restaurant.com` / `Admin@123`

## Notes

- Customers must use a valid QR link that includes both `table` and `token`.
- The project keeps the current stack: Express, MySQL, vanilla HTML/CSS/JS, and Paystack.
