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
4. In **Authentication → Providers**, enable **Email** sign-in, allow sign-ups, and keep email confirmation enabled. In **Authentication → URL Configuration**:
   - Set **Site URL** to your production Netlify origin, with no path (for example, `https://your-nexa-site.netlify.app`).
   - Add the exact confirmation callback `https://your-nexa-site.netlify.app/login` to **Redirect URLs**. Replace the example host with the site's actual Netlify domain; add the corresponding `/login` URL for any production custom domain you use.
   - In Netlify's environment variables, set `VITE_SITE_URL` to that same production origin. The app appends `/login`, so confirmation returns to the sign-in screen. If `VITE_SITE_URL` is unset in a deployed build, the app uses the current site origin instead.
   - For local confirmation testing, set `VITE_SITE_URL=http://localhost:5173` and add `http://localhost:5173/login` to **Redirect URLs**. Without that override, local confirmation uses the Supabase **Site URL**.

   Supabase's confirmation email must use its normal confirmation URL (the default `{{ .ConfirmationURL }}` template); the app processes the returned auth session and presents the login page when the user is not signed in. Confirmations must be completed before password sign-in.
5. Run `npm run dev`, open `/signup` (or choose **Create account** on the login screen), and complete email confirmation before signing in. The first account receives access to its own workspace; every account is isolated by the existing owner-only RLS policies.

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
