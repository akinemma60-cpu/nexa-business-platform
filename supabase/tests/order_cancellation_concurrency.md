# Order stock concurrency regression checks

These checks require a disposable local Supabase/PostgreSQL database with the
schema and cancellation migration applied. Use two independent database
sessions authenticated as the same test owner, and record product stock and
the order's `status`, item count, and each item's `stock_reserved` value before
and after each case. Do not run these against production data.

The SQL test in `order_cancellation_stock.sql` covers sequential create,
cancel, repeated cancel, reactivate, repeated active status, line update/delete,
insufficient-stock rollback, and active-order deletion. Run it with the local
Supabase database test runner before the two-session checks below.

## Concurrent line insert versus cancellation

1. Start Session A: `begin; select public.set_order_status('<order-id>', 'Cancelled');`
   Leave the transaction open.
2. Start Session B and directly insert a valid item for that same order.
   The statement should wait on the transaction advisory lock.
3. Commit Session A, then let Session B finish.
4. Verify Session B receives `Cannot add items to a cancelled order`, no line
   is inserted, and stock remains unchanged. Reverse the order: if Session B
   inserts first, it reserves stock and Session A waits; after cancellation
   commits, the inserted line must be unreserved and that stock returned.

## Concurrent line update/delete versus status change

Repeat with Session A cancelling an order and holding its transaction open.
In Session B, directly update an existing line's quantity, then repeat in a
fresh setup with a direct line delete. Both statements must wait for Session A.
After they complete, verify a cancelled order has no reserved lines and stock
reflects only active reservations. Reverse the order of the two operations
(line mutation first, status transition second) and verify the same invariant.

## Concurrent status changes

1. Start Session A, cancel an active order, and keep the transaction open.
2. In Session B request reactivation of the same order.
3. Commit Session A. Session B should then reactivate once, reserve each line
   once, and leave stock at its pre-cancellation value (unless another valid
   inventory operation intervened).
4. Repeat with the reverse transaction order and with two concurrent
   cancellations. Repeated status requests must not produce duplicate stock
   adjustments.

## Migration guard and installation race

Use a disposable database copy at the pre-migration schema version.

- Insert a cancelled order and run the migration. It must fail at the legacy
  state guard and roll back its column, functions, and triggers.
- In one session, begin a transaction, update an order's status, and leave the
  transaction open. Start the migration in another session. The migration
  should wait for its table locks. Commit the status update, then verify the
  migration either rejects the now-visible legacy cancelled state or completes
  when the status is not cancelled.
- To test an update arriving after the migration owns its locks, run a
  disposable copy of the migration with a temporary pause immediately after
  the table-lock statement. Attempt an order status update from the second
  session. It must wait; after the migration commits, the update must execute
  through the new trigger and preserve stock invariants.

The migration's global advisory transaction lock serializes all order,
order-item, and product writes, including direct authenticated table writes.
This is intentionally conservative and can reduce write throughput.
PostgreSQL may
abort one participant with a deadlock error if a pre-migration transaction
holds table locks in an opposing order while installation begins; rerun only
after the aborted transaction is understood and the database is quiescent.
