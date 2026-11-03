begin;

-- Drain in-flight legacy writes before inspecting the ambiguous cancelled-order state.
lock table public.orders, public.order_items, public.products in access exclusive mode;

do $$
begin
  if exists (select 1 from public.orders where status = 'Cancelled') then
    raise exception 'Review existing cancelled orders and reconcile their stock before applying this migration';
  end if;
end;
$$;

alter table public.order_items
  add column stock_reserved boolean not null default true;

create or replace function public.serialize_order_inventory_writes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- A single transaction-scoped gate makes every order/item write take the same
  -- lock before row locks, avoiding item-row/order-row lock inversion.
  perform pg_advisory_xact_lock(1313166162, 1);
  return null;
end;
$$;

create trigger orders_serialize_inventory_writes
before insert or update or delete on public.orders
for each statement execute function public.serialize_order_inventory_writes();

create trigger order_items_serialize_inventory_writes
before insert or update or delete on public.order_items
for each statement execute function public.serialize_order_inventory_writes();

create trigger products_serialize_inventory_writes
before insert or update or delete on public.products
for each statement execute function public.serialize_order_inventory_writes();

create or replace function public.adjust_product_stock_for_order_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_ids uuid[];
  locked_order_id uuid;
  order_status text;
begin
  if tg_op = 'INSERT' then
    parent_ids := array[new.order_id];
  elsif tg_op = 'DELETE' then
    parent_ids := array[old.order_id];
  else
    parent_ids := array[old.order_id, new.order_id];
  end if;

  -- Lock both parents in UUID order when a line is moved between orders.
  for locked_order_id in
    select id
    from public.orders
    where id = any(parent_ids)
    order by id
    for update
  loop
    null;
  end loop;

  if tg_op = 'DELETE' then
    if old.stock_reserved and old.product_id is not null then
      update public.products
        set stock = stock + old.quantity
        where id = old.product_id and user_id = old.user_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.stock_reserved and old.product_id is not null then
    update public.products
      set stock = stock + old.quantity
      where id = old.product_id and user_id = old.user_id;
  end if;

  select status into order_status
    from public.orders
    where id = new.order_id and user_id = new.user_id
    for update;
  if not found then raise exception 'Order not found'; end if;

  if order_status = 'Cancelled' then
    if tg_op = 'INSERT' or new.order_id is distinct from old.order_id then
      raise exception 'Cannot add items to a cancelled order';
    end if;
    new.stock_reserved := false;
    return new;
  end if;

  if new.product_id is null then
    new.stock_reserved := false;
    return new;
  end if;

  update public.products
    set stock = stock - new.quantity
    where id = new.product_id
      and user_id = new.user_id
      and stock >= new.quantity;
  if not found then
    raise exception 'Product is unavailable or does not have enough stock';
  end if;

  new.stock_reserved := true;
  return new;
end;
$$;

drop trigger if exists order_items_adjust_stock on public.order_items;
create trigger order_items_adjust_stock
before insert or update or delete on public.order_items
for each row execute function public.adjust_product_stock_for_order_item();

create or replace function public.adjust_product_stock_for_order_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  line record;
begin
  if old.status is distinct from new.status then
    if old.status <> 'Cancelled' and new.status = 'Cancelled' then
      for line in
        select id
        from public.order_items
        where order_id = new.id and user_id = new.user_id and stock_reserved
        order by id
      loop
        update public.order_items set stock_reserved = false where id = line.id;
      end loop;
    elsif old.status = 'Cancelled' and new.status <> 'Cancelled' then
      for line in
        select id
        from public.order_items
        where order_id = new.id and user_id = new.user_id and not stock_reserved and product_id is not null
        order by id
      loop
        update public.order_items set stock_reserved = true where id = line.id;
      end loop;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.reject_cancelled_order_creation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'Cancelled' then
    raise exception 'Create the order first, then cancel it to return reserved stock safely';
  end if;
  return new;
end;
$$;

create trigger orders_reject_cancelled_insert
before insert on public.orders
for each row execute function public.reject_cancelled_order_creation();

create trigger orders_adjust_stock_for_status
after update of status on public.orders
for each row execute function public.adjust_product_stock_for_order_status();

create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  updated_order_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_status is null or p_status not in ('Pending', 'Processing', 'Completed', 'Cancelled') then
    raise exception 'Invalid order status';
  end if;

  update public.orders
    set status = p_status
    where id = p_order_id and user_id = owner_id
    returning id into updated_order_id;
  if not found then raise exception 'Order not found'; end if;
  return updated_order_id;
end;
$$;

revoke all on function public.set_order_status(uuid, text) from anon, public;
grant execute on function public.set_order_status(uuid, text) to authenticated;
revoke all on function public.serialize_order_inventory_writes() from anon, public;
revoke all on function public.reject_cancelled_order_creation() from anon, public;
revoke all on function public.adjust_product_stock_for_order_status() from anon, public;

commit;
