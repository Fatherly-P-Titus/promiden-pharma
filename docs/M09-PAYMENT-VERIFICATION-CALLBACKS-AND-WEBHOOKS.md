# M09 — Payment verification, callback handling, and Paystack webhooks

## Delivered

- `GET /api/payments/verify/:reference`: server calls Paystack Verify Transaction using the server-only secret key. It verifies transaction status, exact amount in kobo, NGN currency, and reference against the saved transaction and order before marking the payment successful.
- `POST /api/webhooks/paystack`: validates `x-paystack-signature` using HMAC-SHA512 over the exact raw HTTP request body. It handles `charge.success`, checks the stored transaction/order and expected amount/currency/reference, records event identity, and treats repeated deliveries idempotently.
- The Express JSON parser retains a request-local raw-body buffer for signature verification. No raw body is stored in the database.
- `frontend/payment.html` callback behavior: a returned `reference` triggers backend verification; a browser redirect alone never confirms payment. On confirmed success the local cart is cleared; otherwise the customer receives a safe pending/error message and advice not to pay twice.
- Successful payment updates `payment_transactions.status`, transaction metadata and timestamps, plus `orders.payment_status`, `paid_at`, and `order_status` (awaiting-payment orders become confirmed).

## Endpoints

- `GET /api/payments/verify/:reference`
- `POST /api/webhooks/paystack`

Configure Paystack Dashboard → Developers → Webhooks to send events to:

`https://YOUR_PUBLIC_DOMAIN/api/webhooks/paystack`

Use the same environment's secret key as the configured Paystack test/live environment. Localhost cannot receive Paystack webhooks directly; use a deployed staging URL or a secure tunnel for development.

## Configuration and prerequisites

1. Apply M06 migration `backend/supabase/migrations/002_payment_foundation.sql` to the target Supabase project.
2. Set `PAYSTACK_SECRET_KEY` on the server only. Never put it in frontend JavaScript or a public environment variable.
3. Set `APP_ORIGIN` to the public website origin; it is used for the Paystack callback URL.
4. Set the webhook URL in the Paystack Dashboard. `PAYSTACK_WEBHOOK_URL` is documentation/configuration context; the endpoint path itself is fixed at `/api/webhooks/paystack`.
5. Confirm `orders`, `payment_transactions`, and `payment_events` exist and the service-role key is private.

## Safety behavior

- A valid callback reference only triggers server-to-server verification; it is not evidence of payment by itself.
- A successful result must match `data.status === "success"`, the stored transaction reference, exact `data.amount` in minor units, and `NGN` currency.
- Webhook signatures are checked against the raw request bytes using timing-safe comparison.
- Repeated events already processed or ignored return `200` without applying the same event again. Failed/incomplete event records can be retried by Paystack.
- Unknown references and amount/currency mismatches do not mark an order paid.
- The browser receives generic errors; server logs should not contain secret keys or raw payment credentials.

## Validation status

The source has been syntax-checked and packaged. This environment has not run a live Supabase integration, browser-based checkout, real Paystack test transaction, or externally delivered webhook. Complete those tests in a configured staging environment before accepting live payments. Payment/order state updates span multiple Supabase REST operations rather than a single database transaction; production hardening should consider a PostgreSQL RPC/transaction for atomic updates and monitoring for failed webhook processing.
