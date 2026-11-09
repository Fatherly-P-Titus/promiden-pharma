# Promiden Pharmaceuticals Ltd — M06 Payment Foundation

**Status:** M06 deliverable — data model and API contract; no Paystack charging code is enabled by this milestone.

## Decisions

- Gateway: Paystack hosted checkout.
- Initial purpose: product and service payments.
- Checkout: customer reviews the order, submits it, then is redirected to Paystack's hosted authorization URL.
- Initial currency: NGN. Persist monetary values as integer minor units (kobo); `100 kobo = NGN 1`.
- Source of truth: Express validates catalogue records and calculates all amounts. The browser never supplies an authoritative price or total.
- Existing catalogue compatibility: legacy `products.price` text remains unchanged. New `price_minor` columns on products and services are the canonical checkout prices. A null `price_minor` means the item is not payable until an administrator sets a verified price. Do not parse legacy price strings automatically.
- Access: all order/payment table access is server-side through Express. RLS is enabled and no browser policies are added.

## Database entities

### `products` and `services`
Add `price_minor BIGINT NULL`. Only published items with a positive, explicitly configured `price_minor` can be purchased. For M06, catalogue prices must be populated deliberately; legacy text values are not migrated into numeric amounts because their format and validity cannot be assumed.

### `orders`
One customer checkout attempt/order. Stores a unique public order number, customer contact snapshot, `order_type` (`products`, `services`, or `mixed`), currency, subtotal/total in kobo, order lifecycle status, payment status, and timestamps. `idempotency_key` is optional but unique when supplied, to make safe retry behaviour possible.

### `order_items`
Stores immutable name/description/price snapshots and quantity for each line. The product/service FK may become null if the catalogue record is deleted, while snapshots preserve order history. Each line has exactly one item type/reference.

### `payment_transactions`
One row per Paystack attempt. A new attempt receives a new unique `provider_reference`; an order may have multiple attempts. Amount and currency are snapshotted from the order at initialization. Provider transaction IDs are stored as text to avoid integer precision issues across JavaScript/JSON systems.

### `payment_events`
Deduplication and audit record for webhook events. Unique `event_key` prevents the same provider event being applied twice. Persist only the event details needed for audit/reconciliation; do not store card numbers, CVV, bank credentials, or secret keys.

## Money rules

- Prices and totals are integer minor units. No floating-point arithmetic for payment calculations.
- For NGN, Paystack's `amount` is sent in kobo.
- Server computes each `line_total_minor = unit_price_minor * quantity` and sums line totals to determine subtotal/total.
- M06 does not add delivery fees, discounts, tax, or service deposits. If any are introduced later, they need explicit server-side calculation and persisted breakdown fields before implementation.
- `total_minor` and transaction amount must be positive before initialization.

## API contract for subsequent milestones

All endpoints are same-origin under `/api`. JSON responses use `{ "success": true, "data": ... }` on success and `{ "success": false, "error": { "code": "...", "message": "..." } }` on failure. Avoid exposing stack traces, SQL details, provider secrets, or raw provider responses.

### `POST /api/orders` — M07/M08
Creates a pending order after validating submitted line items against current published catalogue records and configured `price_minor` values.

Request example:

```json
{
  "idempotencyKey": "client-generated-uuid",
  "customer": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "08000000000"
  },
  "items": [
    { "type": "product", "id": "product-uuid", "quantity": 2 },
    { "type": "service", "id": "service-uuid", "quantity": 1 }
  ],
  "customerNote": "Optional note"
}
```

The sample IDs are illustrative UUID placeholders. Client may submit item IDs, type, and quantity only; it must not set unit price, line total, currency, payment status, or total. The server responds with `orderId`, `orderNumber`, `currency`, server-computed line items, `subtotalMinor`, `totalMinor`, and `paymentStatus: "pending"`.

Validation: valid email; bounded text fields; one or more items; quantity is integer 1–1000; each item is published, payable, and exists; duplicate lines are either normalized/combined or rejected consistently; no zero/negative prices; idempotency key replay returns the original order response when payload identity matches and rejects conflicting reuse.

### `POST /api/payments/initialize` — M08
Request: `{ "orderId": "uuid" }`. The server loads the order, confirms it is eligible and unpaid, generates a unique Paystack reference, creates a pending transaction row, initializes Paystack using the secret key, then returns only the order number and hosted `authorizationUrl` for browser redirection. It never accepts a client-provided amount, email, currency, or reference as authoritative.

### `GET /api/payments/verify/:reference` — M09
Server calls Paystack's verify endpoint and checks provider response `data.status`, `data.reference`, `data.amount`, and `data.currency` against the stored transaction/order. Only an exact match with provider status `success` may set the transaction to `successful` and the order payment status to `successful`. A pending/ongoing/abandoned result remains non-paid; mismatches are recorded for investigation and must not fulfill the order.

Public response should disclose only the order number and safe payment status, not customer records or internal provider payloads. The reference must match a stored transaction.

### `POST /api/webhooks/paystack` — M09
Capture the raw request body before JSON parsing for this route. Validate `x-paystack-signature` with HMAC-SHA512 using the Paystack secret key and constant-time comparison. Persist/deduplicate the event, reconcile it to a stored transaction, verify reference/amount/currency/status, and apply the state change transactionally. Return a success response for safely accepted duplicate events; do not run fulfillment twice.

### Admin endpoints — M10
- `GET /api/admin/orders?paymentStatus=pending&limit=...&cursor=...`
- `GET /api/admin/orders/:id`
- `GET /api/admin/orders/:id/payments`

All require existing authenticated admin sessions. Admins can inspect and reconcile records; they cannot simply edit a payment status to `successful`. Refund support must use a provider-confirmed refund workflow and is outside M06.

## Status model

Order `payment_status`: `pending`, `successful`, `failed`, `cancelled`, `refunded`.

Order `order_status`: `awaiting_payment`, `confirmed`, `processing`, `fulfilled`, `cancelled`.

Transaction `status`: `pending`, `successful`, `failed`, `abandoned`, `ongoing`, `reversed`, `refunded`.

A browser callback is not proof of payment. A closed tab, network timeout, or missing callback is not definitive failure. Reconcile via server-side verification/webhooks. State transitions must be monotonic and idempotent; never downgrade a confirmed successful payment because a stale event arrives later.

## Operational and security notes

- Store `PAYSTACK_SECRET_KEY` only in backend environment configuration; use test keys during development.
- Configure the exact callback and webhook URLs after deployment and require HTTPS in production.
- Do not mark an order paid based on query parameters or frontend state.
- Use a database transaction or equivalent atomic update to prevent callback/webhook races.
- A successful payment must match expected amount, currency, reference, and order.
- Paystack merchant approval for Promiden's specific pharmaceutical catalogue must be confirmed before enabling live transactions.
- Orders contain personal data: minimize collected fields, restrict access, and define retention/fulfilment policy before production.

## M06 acceptance criteria

- [x] Existing M05 schema is preserved; migration is separate and repeatable.
- [x] Product and service catalogue have a canonical integer price field without guessing from legacy text prices.
- [x] Order, order-item, payment-transaction, and webhook-event tables are defined.
- [x] Monetary values use integer minor units and NGN is explicit for the initial rollout.
- [x] Constraints and indexes cover core states, positive quantities/amounts, unique order numbers/references/event keys, and relationships.
- [x] RLS is enabled with no browser-facing policies.
- [x] API contracts and security/state-transition rules are documented for M07–M10.

## Applying the migration

For an existing M05 database, run `backend/supabase/migrations/002_payment_foundation.sql` in Supabase SQL Editor. For a fresh database, run the original `backend/supabase/schema.sql`, then this migration. The migration does not create or change Paystack credentials and does not start accepting payments.

After applying, set verified catalogue prices in `price_minor` deliberately. Example: NGN 1,250.00 is stored as `125000`. Do not update product/service prices based on assumptions from the old text `price` column.

## References

- Paystack Accept Payments: https://paystack.com/docs/payments/accept-payments/
- Paystack Verify Payments: https://paystack.com/docs/payments/verify-payments/
- Paystack Webhooks: https://paystack.com/docs/payments/webhooks/
