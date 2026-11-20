# Deriv templates and shared login

## What the client preview uses

The complete native FXPro application under `client-runtime/fxprotradesite` powers both preview and customer domains. Trading Hub, Smart Trading, Speed Bot and Charts are independent main tabs. Digits, Accumulators and Rise/Fall reuse the supplied template screens and the shell account/socket. DTrader is removed. See [FXPRO_CLIENT_RUNTIME.md](FXPRO_CLIENT_RUNTIME.md) for branding, transport and delivery boundaries. The old `apps/` templates are retained as compatibility source and are no longer mounted or built for client delivery.

## Local preview

Use Node >=22.12. Run `npm ci`, `npm run build`, then `npm run dev` here and open `http://localhost:5173/#client-preview`. Build generates the complete app and its assets; the development server serves that output behind the same origin. Rebuild after native runtime source changes. Local OAuth requires the registered `http://localhost:5173/api/deriv/callback` and matching ignored environment values. Public prices work without login; trading requires an authenticated selected account.

## Set up login on your current Vercel site

You do not need to buy a domain first. The callback is a backend route in this repository.

1. Sign in through the [Deriv developer dashboard](https://developers.deriv.com/docs/) and open its applications area. Create or edit a **New API OAuth application**, select the `trade` scope, and register this exact redirect URL:

   `https://pip-coral-seven.vercel.app/api/deriv/callback`

   Use the issued OAuth client ID; do not substitute a legacy numeric app ID or a personal access token. The [OAuth reference](https://developers.deriv.com/llms/oauth.md) explains exact redirect matching and backend exchange.

2. Apply the repository's Supabase migrations, including `20261116153130_deriv_oauth_sessions.sql`, to the existing platform project. For an already-linked project, use `supabase db push`. The new table holds encrypted, expiring login records and grants access only to the backend service role. It also allows new OAuth client ID formats in saved site settings.

3. In Vercel's project environment settings, add these server-only values:

   | Name | Value |
   | --- | --- |
   | `APP_ORIGIN` | `https://pip-coral-seven.vercel.app` |
   | `DERIV_CLIENT_ID` | The OAuth client ID from step 1 |
   | `DERIV_REDIRECT_URI` | `https://pip-coral-seven.vercel.app/api/deriv/callback` |
   | `SUPABASE_URL` | The existing Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | The backend service role key |
   | `DERIV_SESSION_ENCRYPTION_KEY` | A private 32-byte random key encoded as base64 |

   Generate the encryption key locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Keep it private and preserve it between deployments. Do not put service keys, encryption keys, provider tokens or PATs in `public/config.js` or GitHub.

4. Deploy this repository with Vercel's root directory set to the repository root. `vercel.json` builds the templates, serves `public/`, and routes `/api/deriv/*` to the login function. Remove dashboard overrides that force an older static-only build/output configuration. Redeploy after setting environment values. Then check Connect Deriv and account switching manually. No live account or trade was used during implementation checks.

## A paid customer's domain

Domain verification and OAuth callback registration are separate Deriv settings. After registering and connecting the customer's domain, add `https://their-domain/api/deriv/callback` to that New API OAuth app's redirect/callback URLs. Save that customer's issued client ID in their site's Deriv settings, then complete fulfilment so the domain is live. The Vercel handler resolves the ID through `public_site(domain)`; an unregistered domain or arbitrary query parameter cannot choose someone else's app identity. Register the exact canonical hostname you serve, including `www` if used.

Each domain gets host-scoped session cookies. The site configuration must be live and the callback must be registered before customer account login works. Referral reporting, commission ingestion, domain provisioning and verified payment fulfilment are separate platform concerns; this integration does not claim to complete them.

## Verification and known limits

Run `npm test`, `npm run test --workspace @deriv/core`, `npm run check:apps`, and `npm run build`. The build exports all four apps into `public/apps/`; generated exports, chart assets and graph maps are ignored by Git. The installed SmartCharts 1.10.8 has a guarded postinstall fix for a pending trading-times initialization when the host supplies metadata before chart startup. Reassess that fix when upgrading the pinned package.

Local development sessions are in memory and reset on server restart. Vercel uses encrypted Supabase storage and atomic transaction consumption. Expired storage records are pruned when new records are written. Expired provider tokens require signing in again; no unsupported refresh-token flow is used. A transient provider failure does not destroy an otherwise valid server session.

Runtime dependency audit at integration time reported five moderate inherited findings in the Quill UI dependency chain; no high or critical runtime findings. Broader dependency upgrades were deferred to preserve template compatibility. Real OAuth, payments, customer domains and production deployment require configuration and end-to-end verification.
