-- NEXA's initial owner-scoped schema. Run this migration in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'Other',
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'Pending' check (status in ('Pending', 'Processing', 'Completed', 'Cancelled')),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  constraint order_items_order_owner foreign key (order_id, user_id)
    references public.orders(id, user_id) on delete cascade
);

create index if not exists products_owner_created_idx on public.products(user_id, created_at desc);
create index if not exists customers_owner_created_idx on public.customers(user_id, created_at desc);
create index if not exists orders_owner_created_idx on public.orders(user_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

-- New order items reserve stock; removing an order restores the reserved units.
create or replace function public.adjust_product_stock_for_order_item()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.product_id is not null then
    update public.products
      set stock = stock - new.quantity
      where id = new.product_id and user_id = new.user_id and stock >= new.quantity;
    if not found then
      raise exception 'Product is unavailable or does not have enough stock';
    end if;
    return new;
  elsif tg_op = 'DELETE' and old.product_id is not null then
    update public.products
      set stock = stock + old.quantity
      where id = old.product_id and user_id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger order_items_adjust_stock after insert or delete on public.order_items
for each row execute function public.adjust_product_stock_for_order_item();

-- A single transaction creates the order and its snapshot line items using current catalog prices.
create or replace function public.create_order(p_customer_id uuid, p_status text, p_items jsonb)
returns uuid language plpgsql set search_path = public as $$
declare
  owner_id uuid := auth.uid();
  new_order_id uuid;
  line jsonb;
  product_row public.products%rowtype;
  item_quantity integer;
  order_total numeric(12,2) := 0;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_status not in ('Pending', 'Processing', 'Completed', 'Cancelled') then
    raise exception 'Invalid order status';
  end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and user_id = owner_id
  ) then raise exception 'Customer not found'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item to the order';
  end if;

  insert into public.orders(user_id, customer_id, status)
    values (owner_id, p_customer_id, p_status) returning id into new_order_id;

  for line in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := (line->>'quantity')::integer;
    if item_quantity is null or item_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
    select * into product_row from public.products
      where id = (line->>'product_id')::uuid and user_id = owner_id for update;
    if not found then raise exception 'Product not found'; end if;
    insert into public.order_items(user_id, order_id, product_id, product_name, quantity, unit_price)
      values (owner_id, new_order_id, product_row.id, product_row.name, item_quantity, product_row.price);
    order_total := order_total + product_row.price * item_quantity;
  end loop;

  update public.orders set total_amount = order_total where id = new_order_id and user_id = owner_id;
  return new_order_id;
end;
$$;

alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "owners manage products" on public.products for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owners manage customers" on public.customers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owners manage orders" on public.orders for all to authenticated
  using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid()) and (customer_id is null or exists (
      select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())
    ))
  );
create policy "owners manage order items" on public.order_items for all to authenticated
  using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())
    ) and (product_id is null or exists (
      select 1 from public.products p where p.id = product_id and p.user_id = (select auth.uid())
    ))
  );

revoke all on public.products, public.customers, public.orders, public.order_items from anon, public;
grant select, insert, update, delete on public.products, public.customers, public.orders, public.order_items to authenticated;
revoke all on function public.create_order(uuid, text, jsonb) from anon, public;
grant execute on function public.create_order(uuid, text, jsonb) to authenticated;
