# M08 — Server-side order creation and Paystack initialization

## Implemented

- `POST /api/orders` validates customer details and cart line shape, reloads every selected item from the published Supabase catalogue, and uses only `price_minor` from the database.
- Prices and totals are integer NGN kobo. The API rejects missing/unpriced items, quantities outside 1–1000, more than 50 distinct lines, unsafe integer totals, and orders below ₦50.00 (Paystack's NGN minimum).
- Creates an order plus immutable item-name/description/price snapshots. Supports a client-supplied idempotency key to reduce duplicate order creation on retries.
- `POST /api/payments/initialize` accepts an order ID only, reads the amount and email from the saved order, initializes Paystack from the backend using `PAYSTACK_SECRET_KEY`, then stores the provider reference and hosted checkout URL.
- Frontend sends item IDs and quantities only, displays API errors, checks the redirect is HTTPS on `checkout.paystack.com`, and redirects to hosted checkout.
- The Paystack secret is server-only; do not add it to frontend JavaScript or expose it through `window` configuration.

## Environment

Set `PAYSTACK_SECRET_KEY` to a Paystack **test secret key** in `backend/.env` for development. Set `APP_ORIGIN` to the exact public origin serving the payment page (for example `http://localhost:3000` locally and an HTTPS production origin after deployment). Never commit `.env`.

## Endpoints

### `POST /api/orders`

Request:

```json
{
  "customer": { "name": "Customer Name", "email": "customer@example.com", "phone": "08012345678", "note": "" },
  "items": [{ "type": "product", "id": "valid-product-uuid", "quantity": 2 }]
}
```

Optional header: `Idempotency-Key: pmd_<unique-key>`. Response contains `order.id`, `order.orderNumber`, `order.totalMinor`, and pending statuses.

### `POST /api/payments/initialize`

Request: `{ "orderId": "<saved-order-uuid>" }`. Response contains a Paystack reference and `authorizationUrl`. The backend never accepts a client-supplied amount.

## Important limits / next milestone

- M08 does **not** mark orders as paid. A callback/return from Paystack is not proof of payment. M09 must verify reference, transaction status, amount, and currency with Paystack and process signed webhooks idempotently before changing payment/order state.
- The M06 migration `002_payment_foundation.sql` must be applied in Supabase before using these endpoints. Catalogue tables need explicit valid `price_minor` values for payable items.
- The app uses the existing service-role Supabase client server-side. Keep all database access through the backend.
- Confirm Paystack has approved Promiden's business and intended pharmaceutical catalogue before production/live payments, especially prescription medicines.
- No live Paystack request, Supabase integration test, or browser end-to-end test was performed as part of this package.

## Validation

Run `npm run check` from `backend/`. Then use Paystack test keys and test-mode checkout only after applying the migration and configuring Supabase.
