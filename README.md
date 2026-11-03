# NEXA Business Platform

React + Vite business dashboard backed by Supabase Auth and Postgres. The browser app uses only the Supabase project URL and public publishable key; database authorization is enforced with row-level security.

## Connect your Supabase project

1. In the Supabase dashboard, open **Project Settings → API Keys** (or the project **Connect** dialog). Copy the Project URL and the **publishable** key. A legacy `anon` key also works. Never use a `service_role` or `sb_secret_` key in this frontend.
2. Copy `.env.example` to `.env.local` in the project root and fill in:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   # Optional canonical site origin for signup confirmation links:
   VITE_SITE_URL=https://your-nexa-site.netlify.app
   ```

   Restart the Vite server after editing environment variables. `.env.local` is ignored by Git.
   For Netlify, these `VITE_` variables must instead be set in **Site configuration → Environment variables** (or the site's equivalent environment-variable settings). Vite embeds them into the frontend during the build, so changing a value requires a new production build and deployment; editing the local `.env.local` does not update the published site.
3. In Supabase **SQL Editor**, run [`supabase/migrations/20261002000000_nexa_schema.sql`](supabase/migrations/20261002000000_nexa_schema.sql) once. It creates products, customers, orders, and order_items, the foreign keys, stock triggers, the atomic `create_order` RPC, grants, and owner-only RLS policies.
4. Before enabling order cancellation, verify that existing order items were not edited through direct Supabase table writes. The original stock trigger adjusted inventory on item insert/delete but not item updates, and the old schema has no history from which to reconstruct prior reservations. Reconcile any such inventory discrepancies before proceeding. Then review existing `Cancelled` orders and reconcile their stock before running [`supabase/migrations/20261002120000_order_cancellation_stock.sql`](supabase/migrations/20261002120000_order_cancellation_stock.sql). This additive migration intentionally stops if any cancelled order already exists because the original schema did not record whether its stock was returned. It adds internal order-item reservation tracking, leaves current stock values and RLS policies unchanged, and does not alter business records.
5. In **Authentication → Providers**, enable **Email** sign-in, allow sign-ups, and keep email confirmation enabled. In **Authentication → URL Configuration**:
   - Set **Site URL** to `https://spontaneous-hotteok-73c234.netlify.app` (origin only, no path).
   - Add both `https://spontaneous-hotteok-73c234.netlify.app` and `https://spontaneous-hotteok-73c234.netlify.app/login` to **Redirect URLs**. Add equivalent entries for any production custom domain.
   - In Netlify's build environment, set `VITE_SUPABASE_URL` and either `VITE_SUPABASE_PUBLISHABLE_KEY` or the supported legacy `VITE_SUPABASE_ANON_KEY`. Set `VITE_SITE_URL=https://spontaneous-hotteok-73c234.netlify.app` so signup, resend, and password-recovery links use the canonical production host. These are public browser variables; never use a service-role or secret key.
   - For local testing only, set `VITE_SITE_URL=http://localhost:5173` and add `http://localhost:5173` plus `http://localhost:5173/login` to **Redirect URLs**. Remove localhost URLs from production after local testing if they are no longer needed.

   In **Authentication → Email Templates → Confirm signup**, keep the standard link-based confirmation template. Its **Confirm signup** link should use Supabase's `{{ .ConfirmationURL }}` variable, for example:

   ```html
   <h2>Confirm your email address</h2>
   <p>Follow this link to confirm your email address and finish signing up.</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm email address</a></p>
   ```

   Supabase verifies the link and redirects to `/login`. The app recognizes the signup callback, clears its temporary confirmation session, and shows a success message; the user then signs in with their email and password. Keep **Reset Password** link-based with `{{ .ConfirmationURL }}` so password recovery continues to work. For production email delivery, configure custom SMTP under **Authentication → SMTP Settings**: Supabase's built-in SMTP is restricted to project-team recipient addresses and low hourly volume.
6. Run `npm run dev`, open `/signup` (or choose **Create account** on the login screen), then click the confirmation link in the signup email and sign in. If the link is expired or already used, request a fresh confirmation email from the login screen. If you cannot access an account, use **Forgot password?**; the recovery link returns to NEXA to set a new password. The first account receives access to its own workspace; every account is isolated by the existing owner-only RLS policies.

If a user has already registered but did not receive (or can no longer find) the confirmation email, they can enter the same address on the sign-in screen and choose **Resend confirmation email**.

Every business row has a `user_id` tied to `auth.users`. Authenticated users can only read and manage their own records. New products and customers inherit the signed-in user ID from Postgres defaults. The order RPC validates customer/product ownership, reads current catalog prices, writes order items in one transaction, and decrements stock. Deleting an order restores reserved stock.

## Data behavior

- Products and customers support database-backed create, read, update, and delete.
- Orders can be created with multiple catalog items, filtered, status-updated, cancelled, reactivated, and deleted. Cancellation and reactivation require the additive stock-safe migration above.
- Dashboard revenue includes completed orders. Dashboard and analytics charts derive from database order timestamps and totals.
- Store display preferences remain in browser local storage; date displays and report grouping follow the selected time zone. Currency selection changes formatting only; it does not convert existing values. Business records are stored in Supabase.
- Signed-in users can update their password from Settings → Account; password recovery remains available from the login screen.
- The interface shows loading, empty, configuration, and database error states.

## Read-only order inventory audit

The original schema has no stock-movement ledger or inventory history. Its order-item stock trigger adjusted stock on `INSERT` and `DELETE`, but not on `UPDATE`; authenticated owners could update order items directly. The initial schema also allowed cancelled orders without restoring their reservations. Therefore, current product stock and current order lines cannot prove what stock should be or reconstruct historical discrepancies. Use an authoritative inventory record (for example, a trusted stocktake or external movement ledger) before reconciling; do not infer or automatically apply an adjustment from this query.

The following query is a read-only diagnostic snapshot. Replace the UUID placeholder with the account owner's auth user ID. It reports current available stock and the units attached to non-cancelled orders, plus their sum as an *implied* pre-reservation quantity; this is not a correctness check or reconciliation result.

```sql
with noncancelled_order_units as (
  select oi.product_id, sum(oi.quantity)::bigint as units
  from public.order_items oi
  join public.orders o on o.id = oi.order_id and o.user_id = oi.user_id
  where o.user_id = 'YOUR_AUTH_USER_UUID'::uuid
    and oi.product_id is not null
    and o.status <> 'Cancelled'
  group by oi.product_id
)
select
  p.id as product_id,
  p.name,
  p.stock as current_available_stock,
  coalesce(n.units, 0) as noncancelled_order_units,
  p.stock + coalesce(n.units, 0) as implied_pre_reservation_stock,
  p.updated_at as product_last_updated_at
from public.products p
left join noncancelled_order_units n on n.product_id = p.id
where p.user_id = 'YOUR_AUTH_USER_UUID'::uuid
order by p.name, p.id;
```

## Development

```sh
npm install
npm run dev
npm run build
node --test src/auth/authFlow.test.js src/dates.test.js
```
