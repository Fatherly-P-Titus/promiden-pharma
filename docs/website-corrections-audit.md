# Website Corrections Audit — Promiden Pharmaceuticals

This document records the corrections and follow-up work identified during the live-site review. It is the implementation checklist for this dedicated corrections branch. Findings are based on page text and admin UI inspection; interactive checkout/payment flows and visual responsiveness were not tested.

## Confirmed requirements

- Ghanaian cedi (GHS) is the system-wide default currency.
- Administrators enter product prices as numeric values only (for example, `2500`), without a currency symbol.
- Currency configuration and formatting must be centralised and consistent across the admin product interface, public catalogue, cart, orders and payment summaries.
- Paystack transactions must use GHS.
- Preserve server-side order/amount validation, direct Paystack payment verification, and inventory deduction only after verified payment.
- The Ghanaian business address and official Ghanaian phone numbers displayed on the site were confirmed correct; do not change them.
- Do not perform real purchases or payment attempts during testing.

## High-priority corrections

- [ ] Replace NGN/Naira formatting with GHS/GH₵ throughout the application, including admin, catalogue, cart, order views, payment summaries and Paystack transaction configuration.
- [ ] Keep stored/API monetary values numeric; validate the admin price input as a numeric amount and format currency only at display boundaries.
- [ ] Investigate why products with numeric admin prices appear as “Price available on enquiry” / “not configured for online payment” at checkout. Identify and fix the actual eligibility/configuration/validation cause rather than assuming one.
- [ ] Implement appropriate prescription verification and dispensing safeguards for prescription medicines before online purchase/checkout.
- [ ] Replace browser-only homepage and contact drafts with authenticated server-side persistence and publication.
- [ ] Implement secure administrator account management endpoints and UI (server-side password hashing and authorization), or disable/hide nonfunctional controls until the backend is available.
- [ ] Keep Paystack transaction currency and amount aligned with the GHS amount shown to the customer.
- [ ] Preserve server-side payment verification and stock deduction only after confirmed payment.

## Medium-priority corrections

- [ ] Review Amartem Soft-gel description: it contains the “Amatem” typo and Nigeria-specific market wording. Confirm product formulation, strength, indication and Ghana-market copy with the company/qualified reviewer before changing medical claims.
- [ ] Populate the Services catalogue with company-approved service entries and descriptions; connect the public Services section to server-managed services and replace “Service information coming soon” when approved content exists. The admin currently reports zero services.
- [ ] Test Orders & Payments loading, refresh, filters, pagination, and loading/error states without creating a real order.
- [ ] Verify product image loading, consistent dimensions/cropping, missing-image fallback, and persistence of uploaded Supabase Storage images after deployment.
- [ ] Confirm whether exact stock quantities should be publicly visible.
- [ ] Standardise price-on-request behaviour and ensure catalogue/cart eligibility messaging is consistent.
- [ ] Ensure homepage product content reflects live admin-managed products; remove or revise stale illustrative-category wording.
- [ ] Verify social account ownership and destinations before changing them. The Facebook URL currently points to a generic search for “Promise Ventures”; Instagram is `@ubans_glow_skincare`; two TikTok accounts are shown (`@promiseventures1` and `@PromidenPharmacyltd`). These have not been confirmed by the company.

## Low-priority polish / further verification

- [ ] Correct hero headline punctuation: “Better health starts with trusted care..” should use a single full stop.
- [ ] Align homepage purchase/enquiry language with the actual checkout capabilities.
- [ ] Perform visual desktop/mobile responsive checks when browser screenshot/interaction access is available.

## Existing behaviour to preserve / not regress

- Product CRUD and stock quantity updates were recently verified by the site owner.
- The public catalogue reflects server-managed products and stock.
- The Ghanaian address and official telephone numbers are correct.
- Existing payment safety messaging and verified-payment inventory handling must remain intact.

## Review limitations and dependencies

- Services review covered the homepage Services section at `index.html#services`; it showed a general summary and “Service information coming soon”, not a separate standalone services page.
- Browser inspection extracted page text. It did not verify visual layout, responsive behaviour, button interactions, actual order submission, or payment processing.
- Company approval is required for service catalogue content, social account links, public stock visibility, and medical product copy.
