-- Promiden Pharmaceuticals Ltd — M11.01 inventory foundation
-- Existing catalogue rows start at zero; administrators must set opening stock.
-- Stock is measured in whole sellable units. Prices remain NGN minor units (kobo).

begin;

alter table public.products
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists inventory_tracking boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_stock_quantity_nonnegative') then
    alter table public.products add constraint products_stock_quantity_nonnegative check (stock_quantity >= 0);
  end if;
end $$;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('opening_balance', 'adjustment', 'sale', 'restock', 'reversal')),
  quantity_delta integer not null check (quantity_delta <> 0),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after integer not null check (quantity_after >= 0),
  order_id uuid references public.orders(id) on delete restrict,
  performed_by uuid references public.admin_users(id) on delete set null,
  note text not null default '',
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  constraint inventory_movement_math check (quantity_after = quantity_before + quantity_delta),
  constraint inventory_sale_is_decrease check (movement_type <> 'sale' or quantity_delta < 0),
  constraint inventory_restock_is_increase check (movement_type <> 'restock' or quantity_delta > 0)
);

create index if not exists inventory_movements_product_created_idx on public.inventory_movements (product_id, created_at desc);
create index if not exists inventory_movements_order_idx on public.inventory_movements (order_id) where order_id is not null;
create unique index if not exists inventory_one_sale_per_order_product_idx on public.inventory_movements (order_id, product_id) where movement_type = 'sale' and order_id is not null;
alter table public.inventory_movements enable row level security;

create or replace function public.promiden_adjust_product_stock(
  p_product_id uuid, p_quantity_delta integer, p_movement_type text,
  p_performed_by uuid default null, p_note text default '', p_idempotency_key text default null
) returns table(product_id uuid, stock_quantity integer, movement_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_before integer; v_after integer; v_movement_id uuid;
  v_existing public.inventory_movements%rowtype;
begin
  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'Stock adjustment must be a non-zero integer' using errcode = '22023';
  end if;
  if p_movement_type not in ('opening_balance', 'adjustment', 'restock', 'reversal') then
    raise exception 'Invalid stock movement type' using errcode = '22023';
  end if;
  if p_idempotency_key is not null then
    select * into v_existing from public.inventory_movements where idempotency_key = p_idempotency_key;
    if found then
      if v_existing.product_id <> p_product_id then raise exception 'Idempotency key belongs to another product' using errcode = '23505'; end if;
      return query select v_existing.product_id, v_existing.quantity_after, v_existing.id; return;
    end if;
  end if;
  select p.stock_quantity into v_before from public.products p where p.id = p_product_id for update;
  if not found then raise exception 'Product not found' using errcode = 'P0002'; end if;
  v_after := v_before + p_quantity_delta;
  if v_after < 0 then raise exception 'Insufficient stock for this adjustment' using errcode = '23514'; end if;
  update public.products set stock_quantity = v_after, updated_at = now() where id = p_product_id;
  insert into public.inventory_movements(product_id,movement_type,quantity_delta,quantity_before,quantity_after,performed_by,note,idempotency_key)
  values(p_product_id,p_movement_type,p_quantity_delta,v_before,v_after,p_performed_by,left(coalesce(p_note,''),500),p_idempotency_key)
  returning id into v_movement_id;
  return query select p_product_id, v_after, v_movement_id;
end;
$$;

revoke all on function public.promiden_adjust_product_stock(uuid, integer, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.promiden_adjust_product_stock(uuid, integer, text, uuid, text, text) to service_role;

commit;
