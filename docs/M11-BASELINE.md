# Promiden Pharmaceuticals Ltd — M11 Baseline

**Milestone:** M11 — Product Catalogue, Shopping Cart & Inventory Management  
**Baseline source:** `promiden-pharma-M10-admin-orders-render-vercel-README-updated.zip`  
**First implementation step:** M11.01 — Inventory Database Foundation

## Locked M11 scope

1. Dedicated customer Products page with product cards and availability.
2. Homepage **Place Order** navigation to the Products page.
3. Customer shopping cart with quantity updates and removal.
4. Existing order creation and Paystack checkout integration.
5. Admin-only product create/edit/remove and image management.
6. Admin stock quantity management with an audit trail.
7. Stock validation and atomic deduction only after verified successful payment.
8. Preserve existing site settings, services, admin authentication, orders, payment verification and deployment structure.

## Architecture retained

- Frontend: HTML, CSS, JavaScript and local jQuery.
- Backend: Node.js / Express.
- Database and media: Supabase PostgreSQL and existing `promiden-public-media` Storage bucket.
- Hosting: Vercel frontend and Render backend.
- Payments: existing Paystack integration; amounts remain NGN kobo.

## Baseline rules

- The M10 project is the source baseline; M11 changes are additive and migration-based.
- No secrets or production credentials belong in the ZIP or frontend.
- Existing products are assigned zero opening stock by M11.01 and must be stocked by an administrator before they are offered for sale.
- The browser cart is advisory only. Prices, publication status and stock are validated server-side.
- A successful browser redirect is not payment evidence. Only server-verified Paystack success may trigger stock deduction.
- Inventory deduction must be atomic, concurrency-safe and idempotent.
- Product deletion must not destroy historical order snapshots or inventory audit history; implementation should prefer archive/unpublish where references exist.

## Milestone sequence

- **M11.01:** Inventory database foundation — included in this baseline package.
- **M11.02:** Admin product management API and interface.
- **M11.03:** Customer Products page and homepage navigation.
- **M11.04:** Shopping cart.
- **M11.05:** Checkout and Paystack inventory integration.
- **M11.06:** End-to-end testing, hardening and deployment.
