# Promiden Pharmaceuticals Ltd — M07 Payment Page and Order Review

## Delivered
- `frontend/payment.html`: responsive customer order-review page.
- `frontend/styles/payment.css`: responsive blue/white checkout styling.
- `frontend/scripts/payment.js`: catalogue loading, search/type filters, priced-item selection, cart quantity/removal controls, NGN subtotal/total display, contact-field validation, and clear M08-not-yet-enabled messaging.
- Homepage navigation now links to `payment.html`.
- `GET /api/public/products` and `/api/public/services` include `price_minor` for displaying explicit, configured prices. Legacy text price fields are not parsed or treated as payment amounts.

## Current behaviour
The page loads published catalogue entries from `/api/public/products` and `/api/public/services`. It allows only entries with a positive integer `price_minor` to be added to the order. The browser cart stores item type, catalogue ID, and quantity only; it does not treat browser prices as authoritative. The server must recalculate all totals in M08.

The form currently validates customer details and order acknowledgement but deliberately does not create an order or initiate a payment. It shows an explanatory notice until `POST /api/orders` and the Paystack initialization endpoint are implemented. This prevents a prototype page from implying that an order has been stored or that a payment was made.

## Prerequisites / known limitations
1. Apply M06 migration `backend/supabase/migrations/002_payment_foundation.sql`.
2. Set a verified positive `price_minor` for each catalogue item to make it available for online checkout. Values are in kobo; for example NGN 1,250.00 is `125000`.
3. The public API service-role query must be able to read the new `price_minor` columns, which are created by the M06 migration.
4. M08 must implement server-side order creation and total calculation, and the page must be connected to it before it can proceed to Paystack.

## Validation
- Frontend JavaScript syntax checked with Node.
- Backend route syntax checked with Node.
- M07 page, CSS, script, and homepage navigation references checked.
- ZIP archive integrity checked.
- Live Supabase/API/browser testing was not performed because no connected project credentials or running deployment were provided.
