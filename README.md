# Promiden Pharmaceuticals Ltd — Frontend and M05 Backend Foundation

This ZIP contains the Promiden Pharmaceuticals Ltd frontend homepage a standalone About Us page, and the M03 administrator sign-in interface.

## Included
- `frontend/index.html` — responsive homepage
- `frontend/styles/homepage.css` — blue-and-white responsive visual design
- `frontend/scripts/homepage.js` — navigation, product filtering, enquiry links, and optional API loading
- `frontend/assets/images/logo.svg` — original vector logo
- `frontend/about.html` — responsive About Us page
- `frontend/styles/about.css` — About page layout and responsive styling
- `frontend/scripts/about.js` — mobile navigation and dynamic footer year
- `frontend/admin-login.html` — responsive administrator sign-in page
- `frontend/styles/admin-login.css` — responsive login styling
- `frontend/scripts/admin-login.js` — client-side validation, password visibility toggle, and Express endpoint request
- `frontend/assets/icons/` — supplied favicon pack (ICO, SVG, PNG sizes, Apple touch icon, Android Chrome icons)
- `frontend/manifest.webmanifest` and `frontend/sw.js` are planned for the PWA milestone and are not included in this homepage-only package.

## Run locally
Open `frontend/index.html` in a browser. For best results, serve the `frontend` directory using a local static server rather than opening the file directly.

For example, from the `frontend` directory:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`.

jQuery and Google Fonts are loaded from CDNs, so those resources need an internet connection in this phase.

## Current integration state
The Express backend and Supabase schema are not part of this frontend milestone ZIP. The homepage contains illustrative product/service categories and placeholder contact details. These are clearly intended to be replaced with verified company content. It can optionally load data when the following endpoints are implemented:
- `GET /api/public/site-settings`
- `GET /api/public/products`
- `GET /api/public/services`

Set `window.PROMIDEN_API_BASE` before `scripts/homepage.js` to use an API base URL.

## About page implementation
- The About page uses the established blue-and-white visual system and the supplied Promiden icon assets.
- It describes the company based on the supplied project brief and avoids unsupported claims about licences, years in business, certifications, or clinical outcomes.
- The medicine-use note is general safety guidance and does not present the site as a substitute for professional advice.

## Branding assets and social previews
- Browser favicon, Apple touch icon, and Android icon references now point to the supplied files in `frontend/assets/icons/`.
- Open Graph and Twitter title/description metadata are configured.
- The uploaded ZIP contains favicon/icon assets but no dedicated Open Graph image file. The homepage therefore does not yet set `og:image` or `twitter:image`; add these when the correct social-preview image is supplied. For reliable social previews, use an absolute HTTPS URL once the site is deployed.

## Notes
- Product prices are not fabricated; product cards use enquiry links instead.
- Product categories and service descriptions are illustrative starter content.
- The project should be reviewed and tested in target browsers before production deployment.


## M03 — Admin Login Page
- Login form validates required username and password fields in the browser and provides accessible status/error messages.
- Password visibility can be toggled; credentials are not stored in local storage or hardcoded into frontend files.
- Submit sends `POST /api/admin/login` with JSON `{ "username": "…", "password": "…" }` and expects a successful JSON response containing `{ "success": true }`.
- On success, the page navigates to `admin-page.html`; the Express backend must protect that page and all admin APIs with a server-side session.
- This milestone is a frontend login interface only. Authentication is not functional until the server endpoint exists. Do not use the sample credentials from the project brief as production credentials.

## M04 — Admin Dashboard UI
Included files:
- `frontend/admin-page.html` — responsive dashboard with Overview, Homepage Content, Products, Services, Contact & Social, and Administrators sections.
- `frontend/styles/admin-page.css` — dashboard styling aligned with the existing blue-and-white design.
- `frontend/scripts/admin-page.js` — navigation, editable homepage/contact draft fields, product/service create-edit-hide-remove interactions, validation, and browser draft persistence.

### M04 prototype behaviour
- Homepage hero and contact settings can be edited and saved as browser-local drafts.
- Product and service entries can be added, edited, hidden/shown, removed, and saved to browser-local drafts. Product price is optional and must only be entered once verified.
- The administrator management section is intentionally disabled until the secure backend is implemented. No passwords are stored in local storage.
- Draft data is local to the current browser profile and is **not** published to the public homepage, shared with other browsers, or persisted to a central database. Clearing browser storage can remove drafts.
- The dashboard includes a prototype warning because page access is not secure until Express session authentication is implemented. Hiding a link or using frontend JavaScript is not access control.

### Required backend integration before production
Implement and enforce server-side session authentication and authorization for the dashboard route and every `/api/admin/*` endpoint. The login page currently posts to `POST /api/admin/login`; the dashboard sign-out button posts to `POST /api/admin/logout`. Recommended protected APIs include `GET /api/admin/session`, `GET/PUT /api/admin/site-settings`, CRUD endpoints for products and services, and administrator list/create/delete endpoints. Store records in Supabase and images in Supabase Storage; validate input and permissions on the server, hash passwords with a modern password-hashing algorithm, protect session cookies, and never trust client-side role checks. The frontend should be connected to these APIs in the next integration milestone.

### M04 validation note
This milestone provides the dashboard UI and local draft interactions only. It does not implement Express authentication, database persistence, uploads, or public-site publishing. Do not deploy it as an operational administration system until those server-side controls are in place.

## M05 — Backend Foundations (Express + Supabase)

M05 adds the initial backend foundation under `backend/`:
- `backend/src/server.js` — Express application, security headers, JSON limits, session middleware, static frontend hosting, API routing, health endpoint, and server-side protection for `admin-page.html`.
- `backend/src/routes/admin.js` — sign-in/out, session inspection, protected site-settings endpoints, product/service CRUD APIs, and administrator account endpoints.
- `backend/src/routes/public.js` — public, published-only site settings, products, and services APIs consumed by the homepage.
- `backend/src/config/session.js` — PostgreSQL-backed session store; sessions are not kept in Express's in-memory development store.
- `backend/src/scripts/create-admin.js` — interactive initial administrator creation; passwords are hashed with bcrypt.
- `backend/supabase/schema.sql` — initial Supabase tables and public-media storage bucket.
- `backend/.env.example` — configuration template; copy to `backend/.env` and replace all placeholders.

### Local setup

Prerequisites: Node.js 20 or newer, an available Supabase project, and its PostgreSQL connection string.

1. In the Supabase SQL Editor, run `backend/supabase/schema.sql`.
2. Copy `backend/.env.example` to `backend/.env` and set `SESSION_SECRET` to a random secret with at least 32 characters, plus `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL` from your Supabase project.
3. From the `backend/` directory run:

   ```bash
   npm install
   npm run create-admin
   npm start
   ```

4. Open `http://localhost:3000`. Use `http://localhost:3000/admin-login.html` for the administrator sign-in page. The dashboard document is redirected to login unless the Express session is authenticated.
5. Verify the service at `http://localhost:3000/api/health`.

Use the Supabase **service role key only on the server**. Never put it in frontend JavaScript, a public environment variable, source control, or a ZIP shared publicly. Do not use the sample credentials from the original project brief. The interactive setup script creates a new administrator with a bcrypt-hashed password.

### Initial API surface

Public:
- `GET /api/health`
- `GET /api/public/site-settings`
- `GET /api/public/products`
- `GET /api/public/services`

Administrator session:
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`

Protected content endpoints (require an authenticated server-side session):
- `GET/PUT /api/admin/site-settings`
- `GET/POST /api/admin/products`, `PUT/DELETE /api/admin/products/:id`
- `GET/POST /api/admin/services`, `PUT/DELETE /api/admin/services/:id`
- `GET/POST /api/admin/administrators`, `DELETE /api/admin/administrators/:id`

### Security and milestone boundaries

- Login attempts are rate-limited; sessions use HTTP-only, SameSite cookies and a PostgreSQL session store. Production cookies are marked Secure.
- Passwords are hashed with bcrypt; plaintext passwords are never returned by the API.
- Mutating admin routes require a session and enforce the configured origin when an `Origin` header is supplied. Keep frontend and API same-origin for this milestone.
- Admin page access and API authorization are enforced by Express, not by hiding buttons in JavaScript.
- Supabase Row Level Security is enabled for application tables. The backend uses the server-only service role key to access them.
- The public APIs only return published products and services. Content is not seeded with the prototype's illustrative entries; add verified content through the admin API or a later connected dashboard.
- The M04 dashboard still uses browser-local draft operations for its content forms. M05 establishes the API/backend foundation, but wiring the dashboard forms and administrator controls to these endpoints is a follow-up integration milestone.
- Image upload handling and storage authorization are not exposed as API endpoints in M05; the bucket is prepared in Supabase for a later upload milestone.
- This code has syntax and static-structure checks, but it has not been verified against your live Supabase project. Configure environment values and test with a non-production project before deployment.

### Running the site

For an admin-enabled local run, start Express from `backend/` and use the site at `http://localhost:3000`. Do **not** deploy the frontend as a standalone static site while expecting its admin area to be protected: a static server bypasses the Express session gate. The production hosting setup must route the website and `/api/*` through the backend (or an equivalent secure deployment adapter).

### Local jQuery and brand icon update
- All frontend pages load jQuery from `frontend/scripts/jquery.js`; no jQuery CDN, `integrity`, or `crossorigin` attributes are used.
- The visible site logo uses `frontend/assets/icons/promiden-favicon.svg`.


## M06 — Payment Foundation (Paystack)

M06 defines the database and API contract for the next payment integration milestones. It does not yet enable live payment processing.

Included: `backend/supabase/migrations/002_payment_foundation.sql` and `docs/M06-PAYMENT-DATA-MODEL-AND-API-CONTRACT.md`. The migration adds canonical `price_minor` fields for products and services and creates `orders`, `order_items`, `payment_transactions`, and `payment_events`. All monetary values are integer kobo for the initial NGN rollout.

### Apply M06

- Existing M05 database: run `backend/supabase/migrations/002_payment_foundation.sql` in Supabase SQL Editor.
- Fresh database: run `backend/supabase/schema.sql`, then the M06 migration.
- Do not convert legacy text prices automatically. A product/service is not payable until an administrator has explicitly configured a verified positive `price_minor` value. For example, NGN 1,250.00 is `125000`.
- RLS is enabled for the new tables and no browser-facing policies are added; access is intended through Express only.
- Review the API contract document before M07 frontend work. M08 will initialize Paystack transactions server-side; M09 will add verification and webhook handling.

Paystack live mode must remain disabled until the merchant account's eligibility for Promiden's intended pharmaceutical products/services is confirmed.


## M07 Payment Page and Order Review
See `docs/M07-PAYMENT-PAGE-AND-ORDER-REVIEW.md`. The review page is implemented; order creation and Paystack redirection remain disabled until M08. Apply the M06 payment migration and configure verified `price_minor` catalogue values before testing checkout.


## M08 — Server-side order and payment initialization

M08 connects the checkout form to server-side order creation and Paystack hosted checkout initialization. Configure `PAYSTACK_SECRET_KEY` (test key during development) and `APP_ORIGIN` in `backend/.env`; apply the M06 Supabase migration and configure payable catalogue prices first. See `docs/M08-ORDER-CREATION-AND-PAYSTACK-INITIALIZATION.md`. Payment verification/webhooks remain M09, so a return from checkout must not be treated as payment confirmation.


## M09 payment verification

M09 adds server-side Paystack transaction verification and a signed webhook endpoint. See `docs/M09-PAYMENT-VERIFICATION-CALLBACKS-AND-WEBHOOKS.md` for endpoints, deployment configuration, and staging validation requirements. Payments are not considered confirmed based solely on a customer redirect.


## M10 — Admin order/payment management

See `docs/M10-ADMIN-ORDERS-AND-DEPLOYMENT.md` for the order-management API, GitHub, Render backend, and Vercel frontend setup. M10 adds an authenticated order register and payment history; payment status remains server-controlled by verified Paystack events. Before deployment, configure `frontend/scripts/runtime-config.js` with the Render API base URL and set exact `APP_ORIGIN` / `FRONTEND_ORIGIN` values in Render. Never commit secrets.
