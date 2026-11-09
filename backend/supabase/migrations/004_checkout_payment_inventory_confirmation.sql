-- Promiden Pharmaceuticals Ltd — M11.05 verified payment and inventory confirmation
-- A successful payment is recorded even when stock has changed; the order is flagged
-- for staff attention and no partial inventory deduction is made.

begin;

alter table public.orders add column if not exists inventory_status text not null default 'pending';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_inventory_status_valid') then
    alter table public.orders add constraint orders_inventory_status_valid
      check (inventory_status in ('pending', 'deducted', 'not_required', 'attention_required'));
  end if;
end $$;

drop function if exists public.promiden_confirm_paid_order_inventory(uuid, text, text, text, text);

create function public.promiden_confirm_paid_order_inventory(
  p_order_id uuid, p_provider_reference text, p_provider_transaction_id text default null,
  p_channel text default null, p_gateway_response text default null
) returns table(order_id uuid, order_number text, inventory_deducted boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype; v_tx public.payment_transactions%rowtype;
  v_item record; v_before integer; v_now timestamptz := now();
  v_deducted boolean := false; v_has_tracked boolean := false; v_attention boolean := false;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  select * into v_tx from public.payment_transactions where provider_reference = p_provider_reference and order_id = p_order_id for update;
  if not found then raise exception 'Payment transaction not found' using errcode = 'P0002'; end if;

  if v_order.payment_status = 'successful' and v_tx.status = 'successful' then
    return query select v_order.id, v_order.order_number, v_order.inventory_status = 'deducted'; return;
  end if;
  if v_order.order_status <> 'awaiting_payment' or v_order.payment_status <> 'pending' then
    raise exception 'Order is not awaiting payment confirmation' using errcode = '23514';
  end if;
  if v_tx.amount_minor <> v_order.total_minor or v_tx.currency <> v_order.currency or v_order.currency <> 'NGN' then
    raise exception 'Payment amount or currency does not match order' using errcode = '23514';
  end if;

  for v_item in
    select oi.product_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi join public.products p on p.id = oi.product_id and p.inventory_tracking = true
    where oi.order_id = p_order_id and oi.item_type = 'product'
    group by oi.product_id order by oi.product_id
  loop
    v_has_tracked := true;
    select p.stock_quantity into v_before from public.products p where p.id = v_item.product_id for update;
    if not found or v_before < v_item.quantity then v_attention := true; end if;
  end loop;

  if exists (select 1 from public.order_items oi where oi.order_id = p_order_id and oi.item_type = 'product' and oi.product_id is null) then
    v_attention := true;
  end if;

  if not v_attention and v_has_tracked then
    for v_item in
      select oi.product_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi join public.products p on p.id = oi.product_id and p.inventory_tracking = true
      where oi.order_id = p_order_id and oi.item_type = 'product'
      group by oi.product_id order by oi.product_id
    loop
      update public.products set stock_quantity = stock_quantity - v_item.quantity, updated_at = v_now
      where id = v_item.product_id returning stock_quantity + v_item.quantity into v_before;
      insert into public.inventory_movements(product_id,movement_type,quantity_delta,quantity_before,quantity_after,order_id,note,idempotency_key)
      values(v_item.product_id,'sale',-v_item.quantity,v_before,v_before-v_item.quantity,p_order_id,
        'Deducted after verified Paystack payment','sale:' || p_order_id::text || ':' || v_item.product_id::text);
      v_deducted := true;
    end loop;
  end if;

  update public.payment_transactions set status='successful', provider_transaction_id=p_provider_transaction_id,
    channel=left(p_channel,80), gateway_response=left(p_gateway_response,200), verified_at=v_now,
    successful_at=coalesce(successful_at,v_now), updated_at=v_now where id=v_tx.id;
  update public.orders set payment_status='successful', order_status='confirmed',
    inventory_status=case when v_attention then 'attention_required' when v_has_tracked then 'deducted' else 'not_required' end,
    paid_at=coalesce(paid_at,v_now), updated_at=v_now where id=v_order.id;
  return query select v_order.id, v_order.order_number, v_deducted;
end;
$$;

revoke all on function public.promiden_confirm_paid_order_inventory(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.promiden_confirm_paid_order_inventory(uuid, text, text, text, text) to service_role;

commit;
