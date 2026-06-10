# Deploy admin panel to Vercel

## Required Vercel project settings

1. **Root Directory:** `apps/web`
2. **Framework Preset:** Next.js
3. **Include source files outside of the Root Directory in the Build Step:** ON  
   (Project Settings → General → Root Directory section)
4. **Node.js Version:** 20.x

Leave Build/Install commands empty in the dashboard. This repo includes `apps/web/vercel.json`.

## Environment variables

Add all three for **Production** and **Preview**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Copy values from your local `apps/web/.env.local`.

## Redeploy

After changing settings or env vars, open Deployments and click **Redeploy**.

If build fails, open the deployment log and search for `Vercel monorepo check failed` for a clear error message.
