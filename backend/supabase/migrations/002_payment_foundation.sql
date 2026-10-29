-- Promiden Pharmaceuticals Ltd — M06 payment foundation
-- Idempotent migration for an existing M05 Supabase database.
-- Currency amounts are stored as integer minor units (NGN kobo). 100 kobo = NGN 1.
-- Run in Supabase SQL Editor using the project owner account.

begin;

-- Canonical, server-trusted prices. Existing legacy text price remains for UI compatibility.
alter table public.products
  add column if not exists price_minor bigint;

alter table public.services
  add column if not exists price_minor bigint;

-- Add positive-or-null checks without failing when this migration is re-run.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_price_minor_positive') then
    alter table public.products add constraint products_price_minor_positive
      check (price_minor is null or price_minor > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_price_minor_positive') then
    alter table public.services add constraint services_price_minor_positive
      check (price_minor is null or price_minor > 0);
  end if;
end $$;

-- Do not infer prices from legacy text strings. Existing rows remain non-payable until an
-- administrator explicitly enters and verifies a price_minor value.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key text unique,
  customer_email text not null,
  customer_name text not null default '',
  customer_phone text not null default '',
  order_type text not null check (order_type in ('products', 'services', 'mixed')),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  order_status text not null default 'awaiting_payment'
    check (order_status in ('awaiting_payment', 'confirmed', 'processing', 'fulfilled', 'cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'successful', 'failed', 'cancelled', 'refunded')),
  customer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null check (item_type in ('product', 'service')),
  product_id uuid references public.products(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  item_name_snapshot text not null,
  item_description_snapshot text not null default '',
  quantity integer not null check (quantity > 0 and quantity <= 1000),
  unit_price_minor bigint not null check (unit_price_minor > 0),
  line_total_minor bigint not null check (line_total_minor > 0),
  created_at timestamptz not null default now(),
  constraint order_item_reference_matches_type check (
    (item_type = 'product' and service_id is null) or
    (item_type = 'service' and product_id is null)
  ),
  constraint order_item_total_matches_quantity check (line_total_minor = unit_price_minor * quantity)
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_reference text not null unique,
  provider_transaction_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending'
    check (status in ('pending', 'successful', 'failed', 'abandoned', 'ongoing', 'reversed', 'refunded')),
  authorization_url text,
  channel text,
  gateway_response text,
  initialized_at timestamptz not null default now(),
  verified_at timestamptz,
  successful_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Store processed webhook identity for deduplication. Avoid persisting card/bank credentials.
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack' check (provider = 'paystack'),
  event_key text not null unique,
  event_type text not null,
  provider_reference text,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_summary text
);

create index if not exists orders_customer_email_created_idx
  on public.orders (customer_email, created_at desc);
create index if not exists orders_payment_status_created_idx
  on public.orders (payment_status, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists payment_transactions_order_idx
  on public.payment_transactions (order_id, created_at desc);
create index if not exists payment_transactions_status_idx
  on public.payment_transactions (status, created_at desc);
create index if not exists payment_events_reference_idx on public.payment_events (provider_reference);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_events enable row level security;

-- No client-facing policies are created. Access is through the Express backend only.

commit;
