# ZN Servis

Job reporting and material usage tracking for ZN Servis.

This is not an inventory system. It records who performed a job, where and when the job happened, and which materials were used with quantities.

## Apps

- `apps/web` - Next.js admin dashboard
- `apps/mobile` - Expo React Native worker app for Android
- `packages/shared` - shared TypeScript types, constants, and Zod schemas
- `packages/i18n` - Serbian UI labels
- `supabase/migrations/0001_initial_schema.sql` - database schema and RLS policies
- `supabase/seed.sql` - starter locations, material groups, and materials

## Supabase setup

Project URL:

```text
https://ndendumuirrlcmcjewoh.supabase.co
```

Run these files manually in your Supabase SQL editor:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/seed.sql`

Then create your first user in Supabase Auth and promote it to admin:

```sql
update public.profiles
set role = 'admin'
where id = '<your-auth-user-id>';
```

## Environment

Copy `.env.example` into app-specific env files as needed.

For the web dashboard, create `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ndendumuirrlcmcjewoh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

For mobile, create `apps/mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://ndendumuirrlcmcjewoh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in the mobile app.

## Run locally

Install dependencies:

```bash
npm install
```

Run the admin dashboard:

```bash
npm run dev:web
```

Run the Android worker app:

```bash
npm run dev:mobile
```

## Current scope

Implemented foundation:

- Admin login and protected dashboard
- Worker creation from web dashboard
- Location management
- Material groups/subgroups and material management
- Reports list with filters
- React Native worker login
- Offline-first report creation with SQLite outbox
- Catalog caching on mobile
- Sync from mobile outbox to Supabase

Still recommended before production:

- Edit/deactivate actions in admin tables
- Better report item duplicate protection in SQL
- Mobile navigation library instead of simple internal screen state
- EAS Android build configuration
- End-to-end testing after Supabase SQL is applied
