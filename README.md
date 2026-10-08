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
3. In Supabase **SQL Editor**, run [`supabase/migrations/20261002000000_nexa_schema.sql`](supabase/migrations/20261002000000_nexa_schema.sql) once. It creates products, customers, orders, and order_items, the foreign keys, stock triggers, the atomic `create_order` RPC, grants, and owner-only RLS policies.
4. In **Authentication → Providers**, enable **Email** sign-in and allow sign-ups. Keep email confirmation enabled. Under **Authentication → URL Configuration**, set the **Site URL** to the production NEXA origin and add that exact origin (for example, `https://your-nexa-site.netlify.app`) to **Redirect URLs**. Local signup without `VITE_SITE_URL` uses Supabase's Site URL rather than redirecting to localhost. Set `VITE_SITE_URL` in the deployment environment only if you need to override the automatic production origin. Add localhost to Supabase Redirect URLs only when explicitly setting `VITE_SITE_URL=http://localhost:5173` to test confirmations locally. Users must follow the confirmation email link before signing in.
5. Run `npm run dev`, create an account, and sign in. The first account receives access to its own workspace; every account is isolated by the existing owner-only RLS policies.

If a user has already registered but did not receive (or can no longer find) the confirmation email, they can enter the same address on the sign-in screen and choose **Resend confirmation email**.

Every business row has a `user_id` tied to `auth.users`. Authenticated users can only read and manage their own records. New products and customers inherit the signed-in user ID from Postgres defaults. The order RPC validates customer/product ownership, reads current catalog prices, writes order items in one transaction, and decrements stock. Deleting an order restores reserved stock.

## Data behavior

- Products and customers support database-backed create, read, update, and delete.
- Orders can be created with multiple catalog items, filtered, status-updated, and deleted.
- Dashboard revenue includes completed orders. Dashboard and analytics charts derive from database order timestamps and totals.
- Store display preferences remain in browser local storage; business records are stored in Supabase.
- The interface shows loading, empty, configuration, and database error states.

## Development

```sh
npm install
npm run dev
npm run build
```
