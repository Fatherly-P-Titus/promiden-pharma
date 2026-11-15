# PR #12 — GHS currency and checkout deployment

## Included changes
- Admin product prices accept a numeric Ghana-cedi amount only (no currency symbol).
- The admin API converts the entered GHS amount to integer pesewas in `products.price_minor`; blank prices remain enquiry-only.
- Product catalogue and checkout UI format amounts using GHS.
- New orders default to GHS and Paystack initialization uses the currency stored on the order.
- Payment verification checks the Paystack currency against the stored order and transaction currency.
- Supabase migration `005_ghs_currency_checkout.sql` changes the defaults for new orders/transactions to GHS while retaining NGN as an allowed currency for historical records.
- The migration updates the payment confirmation function to accept GHS while preserving its inventory-confirmation logic.

## Required deployment order
1. Review and merge this pull request only after code review and automated checks.
2. In the correct Supabase project, run `backend/supabase/migrations/005_ghs_currency_checkout.sql` after migrations 002–004.
3. Confirm the migration completes successfully before deploying the backend.
4. Deploy the backend and frontend from the merged `main` branch.
5. In Admin Dashboard, edit each product that should be purchasable online and re-enter its approved price in GHS. Existing legacy `price` text is intentionally not auto-converted; the migration does not guess its meaning. Saving the product writes `price_minor` in pesewas.
6. Verify the public catalogue, cart totals, order currency and Paystack test-mode currency. Do not use a live payment as a deployment test.

## Important data handling
- Existing orders and payment transactions retain their recorded currency. Historical NGN orders remain verifiable as NGN.
- Existing products are not assigned a new `price_minor` automatically. Until an administrator explicitly re-enters a price, they remain unavailable for online payment.
- Prices are stored as integer pesewas: 2500.00 GHS becomes 250000 pesewas.
- Stock is deducted only by the existing database confirmation function after successful server-side Paystack verification. Stock conflicts continue to flag the order for staff review.

## Verification still required before production
- Run the backend test suite and lint/type checks available in the repository.
- Apply the migration to a staging Supabase project first, then verify defaults, constraints, and function definition.
- Verify Paystack GHS support and account configuration in Paystack test mode.
- Confirm no prescription medicine can be purchased without the required dispensing safeguards; this PR does not implement prescription verification.
