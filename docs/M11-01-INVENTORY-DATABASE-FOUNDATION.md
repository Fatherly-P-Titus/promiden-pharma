# Promiden Pharmaceuticals Ltd — M11.01 Inventory Database Foundation

## Baseline

M11 starts from the M10 Admin, Orders, Payments and Render/Vercel project ZIP. This milestone adds the database foundation for a dedicated customer product catalogue, cart checkout and controlled stock management. Existing product, service, order and Paystack structures are retained.

## Included in M11.01

- `products.stock_quantity`: non-negative whole-unit stock counter; existing products start at `0` and require an administrator to set opening stock.
- `products.inventory_tracking`: explicit switch for whether stock is controlled for a product (defaults to `true`).
- `inventory_movements`: append-only stock movement ledger with before/after quantities, movement type, optional order/admin references and idempotency key.
- `promiden_adjust_product_stock(...)`: row-locked, atomic stock adjustment primitive for future admin product management.
- `promiden_confirm_paid_order_inventory(...)`: row-locked, atomic payment-confirmation and product-stock deduction primitive for the later Paystack integration step. It validates all product quantities before deducting any stock and is safe against duplicate successful callbacks.
- RLS enabled on the ledger; no browser-facing policies are added. Mutation functions are executable only by `service_role`.

## Apply the migration

1. Open the Promiden Pharmaceuticals Supabase project.
2. Open **SQL Editor** and create a new query.
3. Paste the complete contents of `backend/supabase/migrations/003_inventory_foundation.sql`.
4. Run it once and confirm the query completes successfully.
5. Verify the `products` table now contains `stock_quantity` and `inventory_tracking`.
6. Verify `inventory_movements` exists and RLS is enabled.

The migration is designed to be re-runnable. Do not manually edit stock counters in SQL as a routine workflow; later admin APIs will use the adjustment function so the audit ledger stays consistent.

## Important deployment boundary

M11.01 is a database/schema milestone only. The current M10 payment API does **not** call the new paid-order inventory function yet. Do not advertise stock deduction as live until the subsequent backend integration and end-to-end payment tests are complete. Existing products receive zero opening stock by design; set stock through the forthcoming admin interface after M11.02 is deployed.

## Verification checklist

- [ ] Migration completes without errors.
- [ ] `products.stock_quantity` is integer, non-null, default `0`.
- [ ] `products.inventory_tracking` is boolean, non-null, default `true`.
- [ ] `inventory_movements` exists with RLS enabled.
- [ ] Both `promiden_*` functions exist and are executable by `service_role` only.
- [ ] Existing M10 product, service, order and payment records remain intact.

## Next milestone

**M11.02 — Admin Product Management API and interface:** create/edit/remove products, upload images to the existing `promiden-public-media` bucket, set opening stock and adjust stock through the audited database function.
