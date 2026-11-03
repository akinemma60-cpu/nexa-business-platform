begin;

select plan(25);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a8eb4797-5821-48d1-a31b-6c2c23b2aa01',
  'authenticated',
  'authenticated',
  'order-stock-test-a8eb4797@example.invalid',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

do $$
begin
  perform set_config('request.jwt.claim.sub', 'a8eb4797-5821-48d1-a31b-6c2c23b2aa01', true);
end;
$$;

insert into public.products (id, user_id, name, category, price, stock)
values (
  'a8eb4797-5821-48d1-a31b-6c2c23b2aa02',
  'a8eb4797-5821-48d1-a31b-6c2c23b2aa01',
  'Stock trigger test product',
  'Test',
  10,
  10
);

create temporary table order_stock_test_refs (order_id uuid not null);
insert into order_stock_test_refs (order_id)
select public.create_order(
  null,
  'Pending',
  '[{"product_id":"a8eb4797-5821-48d1-a31b-6c2c23b2aa02","quantity":2}]'::jsonb
);

select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  8,
  'creating an order reserves its line quantity exactly once'
);

select lives_ok(
  $$update public.orders set status = 'Cancelled' where id = (select order_id from order_stock_test_refs)$$,
  'direct authenticated-table status update follows the stock trigger'
);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  10,
  'cancelling restores reserved stock'
);
select lives_ok(
  $$update public.orders set status = 'Cancelled' where id = (select order_id from order_stock_test_refs)$$,
  'repeating cancellation is accepted'
);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  10,
  'repeated cancellation does not restore stock twice'
);
select throws_ok(
  $q$insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
     select (select order_id from order_stock_test_refs), id, name, 1, price
     from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'$q$,
  'P0001',
  'Cannot add items to a cancelled order',
  'direct line insertion into a cancelled order is rejected'
);
select is(
  (select count(*)::integer from public.order_items where order_id = (select order_id from order_stock_test_refs)),
  1,
  'rejected insertion leaves the cancelled order lines unchanged'
);

select lives_ok(
  $$select public.set_order_status((select order_id from order_stock_test_refs), 'Pending')$$,
  'reactivation through the status RPC succeeds'
);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  8,
  'reactivation reserves stock'
);
select lives_ok(
  $$select public.set_order_status((select order_id from order_stock_test_refs), 'Pending')$$,
  'repeating the active status is accepted'
);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  8,
  'repeated active status does not reserve stock twice'
);

update public.order_items
set quantity = 3
where order_id = (select order_id from order_stock_test_refs);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  7,
  'updating a reserved line releases the old quantity and reserves the new quantity'
);
delete from public.order_items where order_id = (select order_id from order_stock_test_refs);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  10,
  'deleting a reserved line returns its reservation once'
);

delete from order_stock_test_refs;
insert into order_stock_test_refs (order_id)
select public.create_order(
  null,
  'Pending',
  '[{"product_id":"a8eb4797-5821-48d1-a31b-6c2c23b2aa02","quantity":2}]'::jsonb
);
select lives_ok(
  $$select public.set_order_status((select order_id from order_stock_test_refs), 'Cancelled')$$,
  'second order can be cancelled before the insufficient-stock case'
);
update public.products
set stock = 0
where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02';
select throws_ok(
  $$select public.set_order_status((select order_id from order_stock_test_refs), 'Pending')$$,
  'P0001',
  'Product is unavailable or does not have enough stock',
  'reactivation fails when available stock is insufficient'
);
select is(
  (select status from public.orders where id = (select order_id from order_stock_test_refs)),
  'Cancelled',
  'failed reactivation rolls back the order status'
);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  0,
  'failed reactivation leaves inventory unchanged'
);

update public.products
set stock = 10
where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02';
delete from order_stock_test_refs;
insert into order_stock_test_refs (order_id)
select public.create_order(
  null,
  'Pending',
  '[{"product_id":"a8eb4797-5821-48d1-a31b-6c2c23b2aa02","quantity":2}]'::jsonb
);
select lives_ok(
  $$delete from public.orders where id = (select order_id from order_stock_test_refs)$$,
  'deleting an active order succeeds'
);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  10,
  'deleting an active order returns its reserved stock'
);
select is(
  (select count(*)::integer from public.order_items where order_id = (select order_id from order_stock_test_refs)),
  0,
  'deleting an order cascades its order items'
);

delete from order_stock_test_refs;
insert into order_stock_test_refs (order_id)
select public.create_order(
  null,
  'Pending',
  '[{"product_id":"a8eb4797-5821-48d1-a31b-6c2c23b2aa02","quantity":2}]'::jsonb
);
select lives_ok(
  $$select public.set_order_status((select order_id from order_stock_test_refs), 'Cancelled')$$,
  'order can be cancelled before deletion'
);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  10,
  'cancelling restores stock before the order is deleted'
);
select lives_ok(
  $$delete from public.orders where id = (select order_id from order_stock_test_refs)$$,
  'deleting a cancelled order succeeds'
);
select is(
  (select stock from public.products where id = 'a8eb4797-5821-48d1-a31b-6c2c23b2aa02'),
  10,
  'deleting an already-cancelled order does not restore stock twice'
);
select is(
  (select count(*)::integer from public.order_items where order_id = (select order_id from order_stock_test_refs)),
  0,
  'deleting a cancelled order cascades its unreserved line items'
);

select * from finish();
rollback;
