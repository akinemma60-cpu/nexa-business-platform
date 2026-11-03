import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../migrations/20261002120000_order_cancellation_stock.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../migrations/20261002000000_nexa_schema.sql", import.meta.url), "utf8");
const api = readFileSync(new URL("../../src/lib/api.js", import.meta.url), "utf8");
const ordersUi = readFileSync(new URL("../../src/pages/Orders.jsx", import.meta.url), "utf8");

test("order creation's existing stock reservation runs through the replaced item trigger", () => {
  assert.match(schema, /create or replace function public\.create_order[\s\S]*?insert into public\.order_items/);
  assert.match(migration, /create trigger order_items_adjust_stock\s+before insert or update or delete on public\.order_items/);
  assert.match(migration, /set stock = stock - new\.quantity[\s\S]*?stock >= new\.quantity/);
});

test("cancel and reactivate transitions adjust only lines whose reservation state changes", () => {
  assert.match(migration, /new\.status = 'Cancelled'[\s\S]*?where order_id = new\.id[\s\S]*?and stock_reserved[\s\S]*?set stock_reserved = false/);
  assert.match(migration, /old\.status = 'Cancelled' and new\.status <> 'Cancelled'[\s\S]*?and not stock_reserved[\s\S]*?set stock_reserved = true/);
  assert.match(migration, /if old\.stock_reserved and old\.product_id is not null[\s\S]*?set stock = stock \+ old\.quantity/);
});

test("insufficient stock aborts the reactivation trigger path", () => {
  assert.match(migration, /stock >= new\.quantity[\s\S]*?raise exception 'Product is unavailable or does not have enough stock'/);
  assert.match(migration, /create trigger orders_adjust_stock_for_status\s+after update of status on public\.orders/);
});

test("all order and line mutations take the same transaction-scoped gate before row changes", () => {
  assert.match(migration, /pg_advisory_xact_lock\(1313166162, 1\)/);
  assert.match(migration, /create trigger orders_serialize_inventory_writes\s+before insert or update or delete on public\.orders\s+for each statement/);
  assert.match(migration, /create trigger order_items_serialize_inventory_writes\s+before insert or update or delete on public\.order_items\s+for each statement/);
  assert.match(migration, /create trigger products_serialize_inventory_writes\s+before insert or update or delete on public\.products\s+for each statement/);
  assert.match(migration, /before insert or update or delete on public\.order_items\s+for each row/);
});

test("line triggers lock parent orders in a deterministic order before reading status or changing stock", () => {
  assert.match(migration, /parent_ids := array\[old\.order_id, new\.order_id\]/);
  assert.match(migration, /where id = any\(parent_ids\)\s+order by id\s+for update/);
  assert.ok(migration.indexOf("order by id\n    for update") < migration.indexOf("set stock = stock - new.quantity"));
  assert.match(migration, /if order_status = 'Cancelled' then[\s\S]*?tg_op = 'INSERT' or new\.order_id is distinct from old\.order_id[\s\S]*?Cannot add items to a cancelled order/);
});

test("migration check is transactional, blocks status and line writes, and preserves ambiguous legacy-data protection", () => {
  assert.match(migration, /^\s*begin;/i);
  const lockPosition = migration.indexOf("lock table public.orders, public.order_items, public.products in access exclusive mode");
  const guardPosition = migration.indexOf("if exists (select 1 from public.orders where status = 'Cancelled')");
  const commitPosition = migration.toLowerCase().lastIndexOf("commit;");
  assert.ok(lockPosition >= 0 && guardPosition > lockPosition && commitPosition > guardPosition);
  assert.match(migration, /Review existing cancelled orders and reconcile their stock before applying this migration/);
});

test("status updates use the RPC whose transaction invokes the database stock trigger; UI confirms cancellation", () => {
  assert.match(api, /rpc\("set_order_status"/);
  assert.match(ordersUi, /Cancel this order\? Its reserved stock will be returned/);
  assert.match(migration, /update public\.orders[\s\S]*?where id = p_order_id and user_id = owner_id/);
});

test("status transitions and failed stock reservations are left to PostgreSQL transaction rollback", () => {
  assert.match(migration, /create trigger orders_adjust_stock_for_status\s+after update of status on public\.orders/);
  assert.match(migration, /raise exception 'Product is unavailable or does not have enough stock'/);
  assert.match(migration, /create or replace function public\.set_order_status[\s\S]*?update public\.orders/);
});

test("migration adds no RLS-policy changes or direct-write privilege revocations", () => {
  assert.doesNotMatch(migration, /create policy|drop policy|alter table public\.(orders|order_items).*row level security/i);
  assert.doesNotMatch(migration, /revoke all on public\.(orders|order_items)/i);
});
