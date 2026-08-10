# StyleHub Store

StyleHub is a clothing ecommerce implementation with a Next.js storefront/admin app, an Express backend API, Supabase data storage, Stripe Checkout, and Slack order notifications.

## Apps

- `apps/web`: Next.js storefront and admin panel for Vercel.
- `apps/api`: Express API for Render.
- `supabase/migrations`: Supabase schema and order payment function.

## Local Development

1. Apply the Supabase migration in `supabase/migrations/001_stylehub_schema.sql`.
2. Configure `apps/api/.env` from `apps/api/.env.example`.
3. Seed data:

```bash
cd apps/api
npm install
npm run seed
```

4. Run the API and web app:

```bash
cd apps/api && npm run dev
cd apps/web && npm run dev
```

The storefront runs at `http://localhost:3000`, the API at `http://localhost:4000`, and the admin panel at `http://localhost:3000/admin`.
