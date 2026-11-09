# Promiden Pharmaceuticals Ltd — M11.05
## Checkout and Paystack Integration Hardening

This package builds on the M11.04 shopping-cart enhancement and strengthens the server-side checkout/payment confirmation workflow.

### Included changes

- Paystack payment initialization reuses an existing pending authorization session when a customer retries checkout, reducing accidental duplicate references.
- Failed or abandoned payment attempts can be retried against an order that is still awaiting payment.
- Successful payment verification now calls the database function `promiden_confirm_paid_order_inventory` rather than independently updating payment and order records.
- The database commits payment confirmation and stock deduction in one transaction.
- Inventory is deducted only after Paystack verification and only when all tracked product quantities remain available.
- If stock changed after checkout, the payment is still recorded as successful, no partial stock deduction occurs, and the order is marked `inventory_status = 'attention_required'` for staff review.
- Services-only orders are marked `inventory_status = 'not_required'`.
- Customer return messaging distinguishes ordinary payment confirmation from a paid order requiring fulfilment review.
- Paystack webhook and browser callback paths share the same idempotent confirmation routine.

### Database migration required

Run this migration in the Supabase SQL Editor:

`backend/supabase/migrations/004_checkout_payment_inventory_confirmation.sql`

It adds `orders.inventory_status` and replaces the payment/inventory confirmation function. The migration is transactional and intended to be applied once; it is also safe to re-run because the column and constraint are guarded and the function is dropped/recreated.

### Deployment

1. Back up or commit the current working project.
2. Reconcile this package with the latest GitHub `main` branch before replacing files. This ZIP descends from the M11.04 package and may not contain unrelated changes made directly on GitHub after that baseline.
3. Run migration `004_checkout_payment_inventory_confirmation.sql` in Supabase.
4. Deploy the backend to Render.
5. Deploy the frontend to Vercel.
6. Confirm `APP_ORIGIN` is the exact deployed frontend origin and `PAYSTACK_SECRET_KEY` is configured in Render. Do not put the secret in frontend files or share it in chat.

### Test plan

Use Paystack test credentials and test payment methods first.

1. Submit a valid product order and confirm the server creates an order with `payment_status = pending` and `inventory_status = pending`.
2. Initialize payment and confirm the customer is redirected to Paystack hosted checkout.
3. Complete a successful test payment. Confirm the server verifies the reference, amount, and NGN currency with Paystack.
4. Confirm the order and payment transaction become successful, and `inventory_status = deducted` for tracked product orders.
5. Confirm exactly one `sale` row per order/product in `inventory_movements`, and that stock decreases by the purchased quantity.
6. Repeat the verification request or webhook delivery. Confirm stock is not deducted a second time.
7. Test a failed/abandoned payment, then retry. Confirm the order can be paid on a later attempt.
8. Test a stock conflict by reducing stock after order creation but before successful payment confirmation. Confirm the payment is still recorded, stock is not partially deducted, and `inventory_status = attention_required`.
9. Test a services-only order; confirm it is paid with `inventory_status = not_required`.

### Important operational note

The `attention_required` status represents a payment that Paystack has verified as successful but whose product stock could not be fully deducted. Promiden staff must review fulfilment and contact the customer as appropriate. This package does not automatically issue refunds or send customer email/SMS notifications.

### Validation scope

JavaScript syntax and backend package checks are run locally when packaging. No live Supabase, Render, Vercel, or Paystack test payment is performed by this package build.
