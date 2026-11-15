-- Promiden Pharmaceuticals Ltd — M12 GHS currency and checkout price support
-- Existing historical NGN orders/transactions remain NGN. New orders default to GHS.
-- Product prices are stored as integer pesewas (100 pesewas = GH₵1.00).
-- Run after migrations 002, 003 and 004 in Supabase SQL Editor.

begin;

-- Keep both currencies valid for historical records while making GHS the default.
alter table public.orders alter column currency set default 'GHS';
alter table public.payment_transactions alter column currency set default 'GHS';

alter table public.orders drop constraint if exists orders_currency_check;
alter table public.orders add constraint orders_currency_check
  check (currency in ('GHS', 'NGN'));

alter table public.payment_transactions drop constraint if exists payment_transactions_currency_check;
alter table public.payment_transactions add constraint payment_transactions_currency_check
  check (currency in ('GHS', 'NGN'));

-- The 004 confirmation function originally restricted all payments to NGN.
-- Update its stored definition without changing the inventory/payment transaction logic.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.promiden_confirm_paid_order_inventory(uuid,text,text,text,text)'::regprocedure
  ) into v_definition;

  if position('v_order.currency <> ''NGN''' in v_definition) = 0 then
    if position('v_order.currency not in (''GHS'', ''NGN'')' in v_definition) = 0 then
      raise exception 'Unexpected payment confirmation function definition; refusing unsafe automatic rewrite.';
    end if;
  else
    v_definition := replace(
      v_definition,
      'v_order.currency <> ''NGN''',
      'v_order.currency not in (''GHS'', ''NGN'')'
    );
    execute v_definition;
  end if;
end $$;

comment on column public.products.price_minor is
  'Online product price in integer minor units; for GHS, 100 pesewas = GH₵1.00. Null means enquiry-only.';
comment on column public.services.price_minor is
  'Online service price in integer minor units; for GHS, 100 pesewas = GH₵1.00. Null means enquiry-only.';

commit;
