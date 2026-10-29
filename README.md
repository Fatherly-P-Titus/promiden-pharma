# Promiden Pharmaceuticals Ltd

Website frontend, Express.js API, Supabase data layer, Paystack checkout integration, and administrator tools. This repository is prepared for **GitHub source control**, **Vercel frontend hosting**, and **Render backend hosting**.

> **Deployment status:** Configuration and implementation files are included, but this project has not been deployed to your accounts or verified against your live Supabase or Paystack accounts. Complete the staging checklist below before accepting real orders or payments.

## Contents

```text
promiden-pharma-M10/
├── frontend/                         # Static HTML, CSS, JavaScript and assets
│   ├── index.html                    # Public homepage
│   ├── about.html                    # About page
│   ├── payment.html                  # Order review and checkout page
│   ├── admin-login.html              # Administrator login
│   ├── admin-page.html               # Administrator dashboard
│   ├── styles/                       # Page stylesheets
│   ├── scripts/                      # Frontend scripts, including runtime-config.js
│   ├── assets/                       # Logo, icons and image assets
│   └── vercel.json                   # Vercel frontend configuration
├── backend/                          # Express.js API (Node.js 20+)
│   ├── src/
│   │   ├── server.js                 # Express app and middleware
│   │   ├── routes/                   # Public, admin and payment routes
│   │   ├── middleware/               # Authentication middleware
│   │   ├── config/                   # Session configuration
│   │   └── scripts/create-admin.js   # Interactive administrator setup
│   ├── supabase/                     # Schema and SQL migrations
│   ├── .env.example                  # Backend environment template
│   └── package.json
├── docs/                             # Milestone and API documentation
├── .github/workflows/                # Repository checks
├── render.yaml                       # Render Blueprint for backend service
└── README.md
```

## Architecture

- **Frontend:** HTML, CSS, JavaScript, jQuery; hosted as a static site on Vercel.
- **Backend:** Node.js and Express; hosted as a web service on Render.
- **Database:** Supabase PostgreSQL, accessed by the backend.
- **Sessions:** PostgreSQL-backed Express sessions.
- **Payments:** Paystack-hosted checkout, server-side transaction verification and webhook processing.
- **Currency:** Initial checkout currency is NGN. All payment amounts are integer minor units (kobo); ₦1,250.00 is stored as `125000`.

The browser is not trusted to set prices or declare a payment successful. The backend calculates order totals from database catalogue records. Payment confirmation must come from server-side verification or a valid Paystack webhook.

## Requirements

- Node.js 20 or newer and npm.
- A Supabase project with PostgreSQL access.
- A Paystack account configured for test mode during development.
- Git and a GitHub repository.
- Render and Vercel accounts for deployment.

## Local development

### 1. Configure Supabase

For a new database, run `backend/supabase/schema.sql` in the Supabase SQL Editor. For an existing M05 database, apply the migrations in order, including:

- `backend/supabase/migrations/002_payment_foundation.sql`

Read the related files under `docs/` before applying SQL. Back up any existing data and review the migration against your actual schema. Do not assume a migration has been applied just because it is included in this repository.

### 2. Configure the backend environment

Copy `backend/.env.example` to `backend/.env` and replace the placeholders. At minimum, configure:

- `NODE_ENV=development`
- `PORT=3000`
- `APP_ORIGIN=http://localhost:3000`
- `FRONTEND_ORIGIN=http://localhost:3000`
- `SESSION_SECRET` with a random secret of at least 32 characters
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `PAYSTACK_SECRET_KEY` using a Paystack **test** secret key
- `PAYSTACK_WEBHOOK_URL` for the public webhook endpoint when deployed

Use the Supabase PostgreSQL connection string appropriate for the deployment environment. Never expose `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SESSION_SECRET`, or `PAYSTACK_SECRET_KEY` in frontend files or public environment variables. Do not commit `.env` files.

### 3. Install and run the backend

From the repository root:

```bash
cd backend
npm install
npm run check
npm run create-admin
npm start
```

The administrator setup script interactively creates an administrator account and hashes the password. Use a unique, strong password; do not use sample or placeholder credentials.

With the backend running, visit:

- Homepage: `http://localhost:3000/`
- Administrator login: `http://localhost:3000/admin-login.html`
- Health check: `http://localhost:3000/api/health`
- Payment/order review: `http://localhost:3000/payment.html`

Serve the frontend through Express for local development when testing sessions and protected admin routes. Opening files directly with `file://` or using a separate static server can change origin and cookie behaviour.

## Catalogue pricing and checkout prerequisites

Products and services are not eligible for checkout until a verified positive `price_minor` value has been explicitly configured in the database. Legacy text prices are not automatically converted. Ensure that each payable catalogue entry is published and correctly priced before testing.

The checkout flow is intended to:

1. Collect the customer's contact details and selected catalogue item IDs/quantities.
2. Create the order on the backend, which reloads item data and calculates the total from the database.
3. Initialize Paystack from the backend using the stored order amount and customer email.
4. Redirect the customer to Paystack-hosted checkout.
5. Confirm payment only after server-side transaction verification or valid signed webhook processing.

A browser redirect, client-side message, or screenshot is **not** proof of payment. Do not manually change payment records to mark an order paid.

## Administrator order management (M10)

The authenticated administrator order area supports:

- Listing and filtering orders by status/payment status, with pagination.
- Viewing customer/order details and item price snapshots.
- Reviewing payment transaction references and payment history.
- Updating eligible order fulfilment states, such as Processing and Fulfilled.
- Cancelling eligible unpaid orders under the implemented rules.

The admin API includes:

- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status`

These endpoints require a valid administrator session. Payment status remains server-controlled by verified Paystack events; the admin interface must not be used to manufacture a successful payment state.

## Deployment: GitHub → Render + Vercel

### 1. Push the source to GitHub

1. Extract the project and create a private GitHub repository.
2. Put the contents of this project at the repository root so `frontend/`, `backend/`, `docs/`, `.github/`, `render.yaml`, and `README.md` are top-level entries.
3. Inspect `git status` and confirm no `.env` file, credential, database password, private key, or live Paystack secret is staged.
4. Commit and push the project. Keep production secrets in the hosting provider's environment settings, not in Git.

Example commands, run from the extracted project root after creating an empty GitHub repository:

```bash
git init
git add .
git status
git commit -m "Prepare Promiden M10 deployment"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the example repository URL with your actual GitHub repository. Review the staged files before committing.

### 2. Deploy the backend to Render

The included `render.yaml` defines a Node web service with `backend/` as its root directory, `npm install` as the build command, `npm start` as the start command, and `/api/health` as the health check.

1. In Render, create a new Blueprint or web service connected to the GitHub repository.
2. Review the detected settings and confirm the backend root directory is `backend`.
3. Set the environment variables in the Render dashboard:
   - `NODE_ENV=production`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `SESSION_SECRET` (use a strong, unique production secret)
   - `PAYSTACK_SECRET_KEY` (use the test key for staging)
   - `APP_ORIGIN` (the canonical public site origin used by the application/Paystack return flow)
   - `FRONTEND_ORIGIN` (the exact deployed frontend origin, without a trailing slash)
   - `SESSION_SAME_SITE=none` when cross-site HTTPS session cookies are required
   - `PAYSTACK_WEBHOOK_URL` set to the public URL for `/api/webhooks/paystack`
4. Deploy and confirm `https://YOUR-RENDER-SERVICE.onrender.com/api/health` responds successfully.
5. Configure the matching webhook URL in the Paystack Dashboard for the same test/live environment as the server key.

Do not assume that a Render deployment automatically applies database migrations. Apply and verify the required SQL separately in Supabase.

### 3. Deploy the frontend to Vercel

1. Create a Vercel project connected to the same GitHub repository.
2. Set the project root directory to `frontend`.
3. Before deploying, update `frontend/scripts/runtime-config.js` so `window.PROMIDEN_API_BASE` points to the deployed Render API origin, for example:

   ```js
   window.PROMIDEN_API_BASE = 'https://YOUR-RENDER-SERVICE.onrender.com';
   ```

   Use your actual Render URL. This value is a public API base URL, not a secret.
4. Deploy and test the homepage, product/service loading, payment page, and admin login.

The included `frontend/vercel.json` contains basic static frontend URL settings. It does not deploy the backend or replace the need to configure the API URL and environment variables.

### 4. Cross-origin sessions and custom domains

When Vercel and Render use different site domains, administrator sessions depend on correct CORS and cookie settings. Use HTTPS, an exact allowed frontend origin, HTTP-only cookies, and `SameSite=None; Secure` where cross-site cookies are necessary. Browser privacy controls may still affect third-party cookies.

For a more robust production arrangement, consider custom domains under the same parent domain, for example `www.example.com` on Vercel and `api.example.com` on Render. Configure CORS, cookie options, origins, and Paystack callback/webhook URLs to match the actual domains. Test login persistence and logout in the browsers you support.

## Environment and secret management

- Commit `backend/.env.example`, not `backend/.env`.
- Use separate Paystack test and live keys; never use a live key for staging.
- Store secrets only in Render's environment configuration or an appropriate secret manager.
- Never put a Supabase service-role key or Paystack secret in frontend JavaScript, HTML, Vercel public variables, screenshots, or issue reports.
- Rotate any secret that has been accidentally committed or shared.
- Do not publish customer contact details, session identifiers, or transaction secrets in logs.

## Verification checklist before production

- [ ] Required Supabase schema and migrations have been applied and reviewed.
- [ ] All payable products/services have verified `price_minor` values.
- [ ] Administrator account created securely; default/sample credentials are not used.
- [ ] Backend health endpoint passes on Render.
- [ ] Frontend loads from Vercel and uses the correct Render API URL.
- [ ] Administrator login, session persistence, protected APIs, and logout work over HTTPS.
- [ ] Public APIs expose only intended published catalogue content.
- [ ] Paystack test checkout completes and server verification checks reference, status, amount, and currency.
- [ ] Webhook signature validation and duplicate-event/idempotency handling are tested.
- [ ] Failed, abandoned, duplicate, and mismatched-amount payment scenarios are tested.
- [ ] Admin order filters, detail views, payment history, and allowed fulfilment transitions are tested.
- [ ] No secrets or `.env` files are committed to GitHub.
- [ ] Promiden's Paystack merchant eligibility for its intended products/services has been confirmed before live mode.

## Current milestone map

- **M05:** Express/Supabase backend foundation and administrator sessions.
- **M06:** Payment data model and API contract.
- **M07:** Payment page and order review.
- **M08:** Server-side order creation and Paystack checkout initialization.
- **M09:** Server-side payment verification and webhook processing.
- **M10:** Administrator order/payment management and hosting preparation.
- **M11:** End-to-end staging tests, security review, and production readiness.

## Documentation

See the `docs/` directory for the milestone-specific database, API, payment, and deployment notes. In particular:

- `docs/M06-PAYMENT-DATA-MODEL-AND-API-CONTRACT.md`
- `docs/M07-PAYMENT-PAGE-AND-ORDER-REVIEW.md`
- `docs/M08-ORDER-CREATION-AND-PAYSTACK-INITIALIZATION.md`
- `docs/M09-PAYMENT-VERIFICATION-CALLBACKS-AND-WEBHOOKS.md`
- `docs/M10-ADMIN-ORDERS-AND-DEPLOYMENT.md`

## Important limitations

This README describes the intended project setup and included implementation. It does not mean that GitHub, Render, Vercel, Supabase, or Paystack have been connected or configured on your behalf. Perform the deployment and staging checklist, inspect logs, and verify the actual running services before enabling production payments. Confirm legal, regulatory, and payment-provider requirements for the intended pharmaceutical catalogue independently.
