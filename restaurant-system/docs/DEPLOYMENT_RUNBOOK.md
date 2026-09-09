# IRMS Deployment Runbook

This guide records the deployment and recovery process used for IRMS. It is intentionally free of passwords, Paystack keys, and database connection strings. Keep secrets only in Railway or Vercel environment variables.

## Architecture

```text
Customer phone / browser
        |
        v
Vercel React application
        |
        | /api/* proxy
        v
Railway Express API
        |
        v
Railway MySQL database
```

The frontend is a React/Vite app. The backend is an Express API. Paystack is called by the backend, and customer QR links should lead to the public frontend URL.

## Canonical Production Addresses

- Use the stable Vercel production domain, not a changing preview URL, as the public frontend address.
- Get the current Railway backend domain from the Railway backend service under **Settings** or **Networking**.
- Confirm the backend before connecting anything else:

```text
https://YOUR_RAILWAY_BACKEND/health
```

Expected response:

```json
{"success":true,"status":"ok"}
```

## Railway Backend Setup

Create the Railway backend service from this repository with its root directory set to:

```text
restaurant-system/backend
```

Use the start command from `backend/package.json`:

```text
npm start
```

Seeing `http://localhost:8080` in Railway logs is normal. It is the container's internal address, not the public URL. Railway provides the public HTTPS domain separately.

Set these backend variables in Railway. Do not put production secrets in `.env` files committed to Git.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DB_HOST` | Railway MySQL `MYSQLHOST` reference |
| `DB_PORT` | Railway MySQL `MYSQLPORT` reference |
| `DB_USER` | Railway MySQL `MYSQLUSER` reference |
| `DB_PASSWORD` | Railway MySQL `MYSQLPASSWORD` reference |
| `DB_NAME` | `railway` unless your MySQL service uses another database name |
| `JWT_SECRET` | Long random secret |
| `PAYSTACK_SECRET_KEY` | Paystack test or live secret key |
| `PAYSTACK_PUBLIC_KEY` | Matching Paystack public key |
| `BASE_URL` | Public frontend URL used in generated QR links |
| `CORS_ORIGIN` | Stable Vercel production URL |
| `SERVE_FRONTEND` | `false` when frontend is hosted on Vercel |

After changing Railway variables, redeploy the backend and recheck `/health`.

## Railway MySQL Setup and Import

Add a MySQL service to the same Railway project. Open its **Connect** panel and use the current public TCP proxy host and port. These details change when a database service is replaced, so never reuse old hostnames, ports, or passwords.

To connect from Windows PowerShell:

```powershell
mysql -h YOUR_PROXY.proxy.rlwy.net -u root -p --port YOUR_PUBLIC_PORT --protocol=TCP railway
```

Enter the password only when MySQL prompts for it. Do not paste a password into the command itself.

To import the schema from PowerShell, use a pipeline because PowerShell does not support the normal `< file.sql` MySQL redirection syntax:

```powershell
Get-Content -Raw "C:\full\path\to\restaurant-system\database\schema.sql" |
  mysql -h YOUR_PROXY.proxy.rlwy.net -u root -p --port YOUR_PUBLIC_PORT --protocol=TCP railway
```

Then validate the import:

```sql
USE railway;
SHOW TABLES;
DESCRIBE users;
SELECT id, username, email FROM users;
```

Common import results:

- `Table 'users' already exists`: the database was partially imported already. Use a clean database service, or apply only the missing migration after checking the existing schema.
- `Unknown column 'full_name'`: the existing `users` table is older than the seed script. Import the current schema into a clean database or add the missing migration before seeding.
- `Startup seed skipped: Table 'railway.users' doesn't exist`: schema import did not complete; import `database/schema.sql` and redeploy the backend.
- `mysql.railway.internal` fails on your laptop: expected. That private address only works between Railway services. Use the public TCP proxy details from the MySQL Connect panel for local tools.

## Vercel Frontend Setup

Create the Vercel project from the same GitHub repository with this root directory:

```text
restaurant-system/frontend
```

Set these variables for both Production and Preview:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `/api` |
| `VITE_APP_BASE_PATH` | `/` |
| `BACKEND_API_BASE_URL` | `https://YOUR_RAILWAY_BACKEND/api` |

The frontend's `vercel.json` rewrites browser requests from `/api/*` through Vercel. This avoids browser CORS issues and keeps the frontend code using a simple `/api` base path.

After editing Vercel variables, redeploy the frontend. Environment variables are baked in during the Vite build, so an existing deployment will not update by itself.

## API and CORS Checks

The backend routes use the `/api` prefix:

```text
GET  /api/menu
POST /api/auth/login
POST /api/orders
POST /api/payment/initialize
GET  /api/payment/verify
```

Do not use `/api/api/...`; that creates an invalid double prefix. Do not point the Vercel frontend directly at a Railway endpoint unless backend CORS is intentionally configured for that exact frontend origin.

If a browser shows `No Access-Control-Allow-Origin`, check:

1. Railway backend is running and `/health` succeeds.
2. `CORS_ORIGIN` is the stable Vercel production domain, without a trailing slash.
3. Vercel is using `VITE_API_BASE_URL=/api` and the API rewrite/proxy is present.
4. `BACKEND_API_BASE_URL` ends in `/api` exactly once.
5. Both services have been redeployed after variable changes.

If Vercel returns `404` or `405` for `/api/auth/login`, the Vercel proxy setup or API base path is incorrect. If it returns `502`, the proxy cannot reach a healthy Railway backend.

## QR Code Rules

Every customer QR link must contain both the table number and its token. For production, generated QR links must begin with the public Vercel URL, for example:

```text
https://YOUR_VERCEL_DOMAIN/scan/T1/TABLE_TOKEN
```

If a QR code still contains `localhost`, update the backend `BASE_URL` to the public frontend address and regenerate that QR code. CSS or UI changes do not invalidate table tokens; only a changed public base address requires generating a new QR image.

For local phone testing, `localhost` means the phone itself, not the laptop. Use the laptop's LAN IP, a development server that listens on the network, and the same Wi-Fi or hotspot. For deployed use, the Vercel HTTPS URL works from any phone with internet access.

## Paystack Notes

- Test keys begin with `pk_test_` and `sk_test_`; live keys begin with `pk_live_` and `sk_live_`.
- The public and secret keys must come from the same Paystack mode.
- Configure the backend's external URL and verification callback correctly; local `localhost` cannot receive a real Paystack callback.
- After a payment, the verification flow should redirect customers back to order tracking with the original order and table context.
- A pending payment usually means the verification request or callback could not reach the active backend. Check the Railway logs, `/health`, and the configured Paystack keys.

## Smoke Test After Deployment

1. Open `https://YOUR_RAILWAY_BACKEND/health` and confirm success.
2. Open the Vercel production site and confirm menu items load.
3. Log in with a seeded role account.
4. Generate a QR code from the manager QR page and confirm it uses the Vercel domain.
5. Scan it on a phone and place an order with a valid token.
6. Confirm staff/manager can see and update the order.
7. Use Paystack test credentials, complete payment, and confirm payment status and customer tracking update.
8. Test an invalid QR token, unavailable menu item, invalid quantity, and failed payment; each should show a clear error without breaking the app.

## Safe Recovery Order

When deployment stops working, check in this order:

1. Railway `/health`.
2. Railway database variables and current MySQL service status.
3. `GET /api/menu` directly on the backend.
4. Vercel variables and latest deployment commit.
5. The Vercel `/api` proxy response.
6. Browser console only after the above checks.

This order prevents spending time on frontend errors caused by a backend or database that is unavailable.
