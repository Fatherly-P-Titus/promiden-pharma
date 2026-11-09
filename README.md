# Promiden Pharmaceuticals Ltd

A web platform for Promiden Pharmaceuticals Ltd, with a public product
and services catalogue, shopping cart, administrator dashboard, order
management, inventory controls, and Paystack checkout.

The application is structured as a static frontend and an Express.js
API:

-   **Frontend:** HTML, CSS, JavaScript and local jQuery, deployed to
    Vercel.
-   **Backend:** Node.js and Express, deployed to Render.
-   **Database:** Supabase PostgreSQL.
-   **Authentication and sessions:** Server-side administrator sessions
    backed by PostgreSQL.
-   **Payments:** Paystack-hosted checkout with server-side payment
    verification and webhook handling.

> **Deployment and production note:** This repository contains
> application code and deployment configuration. Do not assume that
> database migrations have been applied, environment variables are
> correct, or live payment processing has been verified. Complete the
> staging and production-readiness checks in this document before
> accepting real orders or payments.

## Features

### Public website

-   Homepage and About page.
-   Public products and services catalogue.
-   Product cards with descriptions, prices and stock availability.
-   Product search and category filtering.
-   Shopping cart and order review.
-   Responsive layout and supplied image/icon assets.

### Administrator dashboard

-   Administrator authentication using server-side sessions.
-   Product management, including creating, editing and removing
    catalogue items.
-   Stock quantity management.
-   Order listing, filtering and order detail review.
-   Order fulfilment status management.
-   Payment transaction and order history review.

All administrators have equal application privileges in the current role
model. Protect administrator credentials and use strong passwords.

### Checkout and inventory

-   The backend creates orders and calculates totals from database
    catalogue records.
-   The browser does not determine authoritative prices or payment
    status.
-   Paystack handles the hosted payment experience.
-   The backend verifies payment status, reference, amount and currency.
-   Inventory confirmation is handled on the server after verified
    payment.
-   Payment confirmation and inventory updates are designed to be
    idempotent so repeated verification or webhook delivery does not
    repeatedly deduct stock.
-   If stock cannot be confirmed when payment succeeds, the order should
    be flagged for attention rather than partially deducting inventory.

The cart is not a stock reservation. Adding an item to a cart or
creating an unpaid order must not reduce available stock.

## Repository structure

``` text
promiden-pharma/
├── .github/
│   └── workflows/                 # Automated backend checks
├── backend/
│   ├── src/
│   │   ├── config/                # Environment, Supabase and session setup
│   │   ├── middleware/            # Authentication and authorization
│   │   ├── routes/                # Public, admin and payment API routes
│   │   ├── scripts/               # Administrator setup script
│   │   ├── utils/                 # Validation and shared utilities
│   │   └── server.js              # Express application entry point
│   ├── supabase/
│   │   ├── schema.sql             # Base database schema
│   │   └── migrations/            # Versioned SQL migrations
│   ├── .env.example               # Backend environment template
│   └── package.json
├── frontend/
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   ├── scripts/                   # Frontend application scripts
│   ├── styles/                    # Stylesheets
│   ├── index.html                 # Homepage
│   ├── about.html                 # About page
│   ├── products.html              # Product catalogue
│   ├── payment.html               # Cart review and checkout
│   ├── admin-login.html           # Administrator login
│   ├── admin-page.html            # Administrator dashboard
│   └── vercel.json                # Vercel configuration
├── docs/                          # Technical and milestone documentation
├── render.yaml                    # Render service configuration
└── README.md
```

## Requirements

-   Node.js 20 or newer.
-   npm.
-   Git.
-   A Supabase project with PostgreSQL access.
-   A Paystack account; use test mode during development.
-   Vercel and Render accounts for deployment.

## Local setup

### 1. Clone the repository

``` bash
git clone https://github.com/Fatherly-P-Titus/promiden-pharma.git
cd promiden-pharma
```

### 2. Configure the database

The project includes a base schema and versioned migrations in
`backend/supabase/`.

For an existing project database, review the current migration history
first and apply only migrations that have not already been applied, in
the correct order. The payment and inventory milestones include:

1.  `002_payment_foundation.sql`
2.  `003_inventory_foundation.sql`
3.  `004_checkout_payment_inventory_confirmation.sql`

Use the Supabase SQL Editor or your established migration workflow. Back
up the database before applying schema changes to an existing
environment.

**Important:** A migration file being present in GitHub does not mean it
has been executed in Supabase. Do not rerun migrations blindly. Review
each migration against the actual database schema and confirm its
successful application.

### 3. Configure backend environment variables

Copy the example file:

``` bash
cd backend
cp .env.example .env
```

On Windows Command Prompt, use:

``` bat
copy .env.example .env
```

Edit `backend/.env` and supply the correct values. The environment
template includes settings for:

  -----------------------------------------------------------------------
  Variable                            Purpose
  ----------------------------------- -----------------------------------
  `NODE_ENV`                          Runtime environment, such as
                                      `development` or `production`

  `PORT`                              Backend listening port

  `APP_ORIGIN`                        Canonical public application origin

  `FRONTEND_ORIGIN`                   Exact frontend origin allowed by
                                      the API

  `SESSION_SAME_SITE`                 Session cookie same-site policy

  `SESSION_SECRET`                    Secret used to sign session cookies

  `SESSION_COOKIE_NAME`               Session cookie name

  `SESSION_MAX_AGE_MS`                Session lifetime in milliseconds

  `SUPABASE_URL`                      Supabase project URL

  `SUPABASE_SERVICE_ROLE_KEY`         Server-side Supabase service-role
                                      key

  `DATABASE_URL`                      Supabase PostgreSQL connection
                                      string

  `PAYSTACK_SECRET_KEY`               Server-side Paystack test or live
                                      secret key

  `PAYSTACK_WEBHOOK_URL`              Public URL for the Paystack webhook
                                      endpoint
  -----------------------------------------------------------------------

Use the exact values appropriate to your local or deployed environment.
The supplied `.env.example` is the authoritative list of template
variables; inspect the backend configuration if you add or change
environment settings.

**Never commit `backend/.env`.** Never place the Supabase service-role
key, database connection string, session secret or Paystack secret key
in frontend files, public client-side variables, screenshots or issue
reports.

### 4. Install dependencies and run the backend

From the `backend/` directory:

``` bash
npm install
npm run check
npm run create-admin
npm start
```

For development with automatic Node.js restart:

``` bash
npm run dev
```

The administrator setup script prompts for account details and securely
hashes the password. Use a strong, unique password. Do not use sample
credentials in a deployed environment.

The backend package requires Node.js 20 or newer.

### 5. Local application testing

When the backend is configured to serve the frontend, use the local
backend origin for testing the application and session-dependent routes.

Common local URLs when running on port `3000`:

-   Homepage: `http://localhost:3000/`
-   About: `http://localhost:3000/about.html`
-   Products: `http://localhost:3000/products.html`
-   Payment and order review: `http://localhost:3000/payment.html`
-   Administrator login: `http://localhost:3000/admin-login.html`
-   Administrator dashboard: `http://localhost:3000/admin-page.html`
-   API health: `http://localhost:3000/api/health`

Use the actual port and origin configured in your environment. Testing
through the backend origin is important for checking CORS and
session-cookie behaviour.

## Product catalogue and inventory

The customer-facing Products page retrieves catalogue data from the
backend. Customers can browse available products, add products to the
cart, change quantities and proceed to checkout.

The administrator dashboard provides product and stock management.
Product records should have valid catalogue information and a verified
payable price before being offered for checkout.

Inventory rules:

1.  Adding a product to a cart does not reserve or deduct stock.
2.  Creating an unpaid order does not deduct stock.
3.  The backend validates requested quantities against current stock.
4.  Stock is deducted only as part of successful, verified payment
    confirmation.
5.  Payment confirmation and inventory deduction must be safe against
    duplicate requests and webhook retries.
6.  If a paid order cannot be fulfilled from available stock, it must be
    flagged for administrative attention; do not silently perform a
    partial deduction.

Test simultaneous checkout attempts for the same low-stock product
before production use.

## Pricing and currency

The backend must calculate payable totals using authoritative database
values, not prices supplied by the browser. The payment integration uses
integer minor units for NGN (kobo); for example, ₦1,250.00 is
represented as `125000` kobo.

Before enabling checkout for a catalogue item, verify that its payable
`price_minor` value is present, positive and correct. Do not assume
legacy display-price text has been converted automatically. Confirm the
database pricing fields and migration state before accepting orders.

## Paystack checkout flow

The intended payment sequence is:

1.  The customer reviews the cart and provides the required contact
    details.
2.  The frontend sends item identifiers and quantities to the backend.
3.  The backend reloads catalogue records, validates availability and
    calculates the order total.
4.  The backend initializes a Paystack transaction using the
    server-calculated amount and customer email.
5.  The customer is redirected to Paystack-hosted checkout.
6.  The backend confirms payment using Paystack server-side verification
    and/or a valid signed webhook.
7.  The backend checks the transaction reference, successful status,
    amount and currency before confirming the order and inventory.

A return URL, browser message, screenshot or client-side callback alone
is not proof of payment. Never mark an order paid manually through
frontend code. Keep Paystack secret keys exclusively on the backend.

Use Paystack test credentials and test transactions until the complete
flow has been validated. Configure the Paystack dashboard webhook URL to
match the deployed backend endpoint and the same test/live environment
as the configured secret key.

## Deployment

The intended hosting arrangement is:

-   **GitHub:** source control.
-   **Render:** Express.js backend.
-   **Vercel:** static frontend.
-   **Supabase:** PostgreSQL database and storage services.

### 1. Push to GitHub

Ensure the project contents are at the repository root, so `frontend/`,
`backend/`, `docs/`, `.github/`, `render.yaml` and `README.md` are
top-level entries.

Before committing:

``` bash
git status
```

Review all staged files and confirm that no `.env` files, passwords, API
secrets, private keys or customer data are included.

Then commit and push:

``` bash
git add .
git status
git commit -m "Update Promiden M11.05 checkout and inventory"
git push origin main
```

### 2. Deploy the backend to Render

The repository includes `render.yaml` for the backend service. Review
the Blueprint settings in Render and confirm that the service uses the
`backend` directory, the appropriate install/build command and the
configured start command.

Set the required production environment variables in the Render
dashboard, including:

-   `NODE_ENV=production`
-   `SUPABASE_URL`
-   `SUPABASE_SERVICE_ROLE_KEY`
-   `DATABASE_URL`
-   `SESSION_SECRET`
-   `SESSION_COOKIE_NAME`
-   `SESSION_SAME_SITE`
-   `APP_ORIGIN`
-   `FRONTEND_ORIGIN`
-   `PAYSTACK_SECRET_KEY`
-   `PAYSTACK_WEBHOOK_URL`

Use the actual deployed frontend and backend origins. Do not include
trailing slashes where the application expects an origin. Use a strong,
unique production session secret. Use the Paystack test key for staging
and the live key only after production approval and testing.

After deployment, test:

``` text
https://YOUR-RENDER-SERVICE.onrender.com/api/health
```

A successful deployment alone does not prove that the database
connection, session store, payment verification or webhook processing is
working. Confirm the health response and review Render logs.

### 3. Deploy the frontend to Vercel

Connect the GitHub repository to Vercel and set the project root
directory to:

``` text
frontend
```

Check `frontend/scripts/runtime-config.js`. Configure
`window.PROMIDEN_API_BASE` to the deployed Render API origin, for
example:

``` js
window.PROMIDEN_API_BASE = 'https://YOUR-RENDER-SERVICE.onrender.com';
```

Replace the example with the actual backend URL. This API base URL is
public configuration, not a secret.

Deploy the frontend and test the homepage, About page, products
catalogue, cart, payment page and administrator login.

### 4. Configure cross-origin sessions

When the frontend and backend are hosted on different origins, CORS and
cookie settings must agree.

-   Use HTTPS for deployed services.
-   Set `FRONTEND_ORIGIN` to the exact Vercel frontend origin.
-   Configure session cookies as HTTP-only and secure in production.
-   Use the appropriate `SameSite` policy. Cross-site HTTPS session
    cookies generally require `SameSite=None; Secure`.
-   Test administrator login persistence, protected API requests and
    logout in supported browsers.

Browser privacy settings may restrict cross-site cookies. A
custom-domain arrangement under the same parent domain may provide a
more reliable production session setup; configure and test it before
relying on it.

## Security and operational guidance

-   Never commit `.env` files or production secrets.
-   Keep the Supabase service-role key and Paystack secret key on the
    backend only.
-   Use separate test and live Paystack keys.
-   Restrict administrator pages and API routes to authenticated
    administrator sessions.
-   Do not trust client-submitted prices, payment status or inventory
    values.
-   Validate all order quantities and catalogue identifiers on the
    server.
-   Keep payment verification and inventory confirmation idempotent.
-   Review database migrations and back up production data before schema
    changes.
-   Avoid logging passwords, session identifiers, secret keys or
    unnecessary customer information.
-   Confirm that the business and intended products/services meet
    Paystack's current merchant and product eligibility requirements
    before enabling live payments.

## Staging and production checklist

Complete these checks in a staging environment before accepting real
customer payments.

### Database

-   [ ] Supabase project and PostgreSQL connection are configured.
-   [ ] Base schema is present.
-   [ ] Required migrations `002`, `003` and `004` have been reviewed
    and applied in order where applicable.
-   [ ] Migration history matches the actual database state.
-   [ ] Catalogue items have valid, positive `price_minor` values.
-   [ ] Inventory quantities and constraints behave as expected.

### Backend and frontend

-   [ ] Backend dependencies install successfully.
-   [ ] `npm run check` passes.
-   [ ] Backend health endpoint reports a healthy database/session
    configuration.
-   [ ] Vercel frontend uses the correct Render API base URL.
-   [ ] Public catalogue displays the intended published products.
-   [ ] Administrator login, session persistence and logout work.
-   [ ] Product creation, editing, stock updates and removal work as
    intended.
-   [ ] Order listing, order details and allowed fulfilment status
    changes work.

### Checkout and inventory

-   [ ] Backend recalculates order totals from database records.
-   [ ] Paystack test checkout initializes with the correct amount and
    currency.
-   [ ] Successful payments are verified server-side.
-   [ ] Invalid signatures and mismatched references are rejected.
-   [ ] Amount and currency mismatches are rejected.
-   [ ] Failed and abandoned payments do not reduce stock.
-   [ ] Duplicate verification and webhook delivery do not duplicate
    inventory deductions.
-   [ ] Concurrent orders cannot oversell stock.
-   [ ] A paid order with an inventory conflict is flagged for
    administrative attention.
-   [ ] Payment transaction history and order status remain consistent.

### Deployment and security

-   [ ] No secret or `.env` file is committed to GitHub.
-   [ ] Render and Vercel use the intended production origins.
-   [ ] HTTPS, CORS and session-cookie behaviour are verified.
-   [ ] Paystack webhook URL is configured for the matching test/live
    environment.
-   [ ] Production backups and rollback procedures are understood.
-   [ ] Live payment processing is enabled only after staging tests and
    merchant eligibility checks are complete.

## Milestone overview

  -----------------------------------------------------------------------
  Milestone                           Scope
  ----------------------------------- -----------------------------------
  M05                                 Backend foundation, Supabase
                                      integration and administrator
                                      sessions

  M06                                 Payment data model and API contract

  M07                                 Payment page and order review

  M08                                 Server-side order creation and
                                      Paystack initialization

  M09                                 Payment verification and webhook
                                      processing

  M10                                 Administrator order/payment
                                      management and hosting preparation

  M11.01                              Inventory database foundation

  M11.02                              Administrator product management

  M11.03                              Customer-facing Products page

  M11.04                              Shopping cart enhancement

  M11.05                              Checkout and Paystack integration
                                      with inventory confirmation

  M11.06                              Inventory synchronization,
                                      end-to-end testing and deployment
                                      readiness
  -----------------------------------------------------------------------

## Project documentation

See the milestone and technical documents in `docs/` and the repository
root for implementation details, database changes and testing notes. In
particular:

-   `docs/M11-BASELINE.md`
-   `docs/M11-01-INVENTORY-DATABASE-FOUNDATION.md`
-   `M11.02-ADMIN-PRODUCT-MANAGEMENT.md`
-   `M11.03-README.md`
-   `M11.04-SHOPPING-CART-ENHANCEMENT.md`
-   `M11.05-README.md`

## License

No open-source license is specified in this repository. All rights
remain with the project owner unless a separate license is added.
