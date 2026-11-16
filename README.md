# Pipforge

A platform for selling templated, branded Deriv trading sites. Clients sign in with Google, design their site
(35 templates, 40 animated backgrounds, 35 typefaces, 20 header compositions, social icons, menu), choose from the country list Deriv publishes, pick or connect a domain, and pay by M-Pesa.
You fulfil the domain and DNS from an admin queue; the client's site then goes live on their own domain.

* **Front-end:** the platform is static HTML in `public/`; four trading templates under `apps/` are built into `public/apps/`. One page, `index.html`, is both the builder app and
  the client-site renderer ("tenant mode", see below). `admin.html` is the fulfilment queue.
* **Backend:** Supabase. Postgres with row level security, Google sign-in, and three Edge Functions.
* **Payments:** M-Pesa STK push (Safaricom Daraja). Card payments are not built yet.

## How it fits together

```
Browser (public/index.html, anon key only)
  ├─ Supabase Auth (Google)                      sign-in
  ├─ rpc complete_profile                        name + phone + consent  -> profiles
  ├─ sites table (RLS: own row only)             autosaved design
  ├─ Edge Function domain-check                  RDAP lookup + clash check against other clients
  ├─ rpc create_order                            SERVER prices the order (pricing + tld_prices tables)
  └─ Edge Function checkout                      reads the order, starts the M-Pesa prompt
Safaricom ──> Edge Function mpesa-callback       verifies with Safaricom, then rpc mark_order_paid
mark_order_paid                                  order paid, site "paid", fulfilment tasks created
You (admin.html)                                 register domain, connect DNS, issue SSL, go live
public_site(domain) RPC                          read-only config for LIVE sites, used by tenant mode
```

The browser never sends a price, never sets a site's status, and never marks anything paid. Those are enforced
in the database (column privileges, a guard trigger, and `SECURITY DEFINER` functions), not just in the UI.

## Set up

### Local development and GitHub

This folder is the main Pipforge application and Git repository, connected to
`https://github.com/kingz254/pip` on `main`. Run commands here, rather than in the
outer download folder. The integrated Deriv sources are tracked under `apps/`, and common auth/trading code is in `packages/deriv-core`. The outer sibling folders are the original downloads.

Run `npm run dev` and open `http://localhost:5173` for the local site preview.
The four template development servers run behind the same preview origin. Refresh after editing platform files in `public/`. With empty Supabase values
in `public/config.js`, it runs in demo mode. The preview does not deploy the site. See [Deriv setup](docs/DERIV_SETUP.md) for the Vercel callback and production session configuration.

Changes reach GitHub after they are tested, committed and pushed; saving a local
file alone does not update the remote repository. Run `npm test` before syncing.
The GitHub workflow also runs tests and checks Edge Functions on each push.
Generated `graphify-out/` maps stay local and are ignored by Git.

### Services

1. **Supabase project.** Create one at supabase.com. Install the CLI (`npm i -g supabase` or see their docs), then
   `supabase login`, `supabase link --project-ref <ref>`, `supabase db push`.
2. **Google sign-in.** In Google Cloud Console create an OAuth client (type Web). Authorised redirect URI:
   `https://<ref>.supabase.co/auth/v1/callback`. In Supabase: Authentication > Providers > Google, paste the client
   ID and secret. Under Authentication > URL Configuration set the Site URL to your app URL and add it (and
   `http://localhost:5173`) to Redirect URLs.
3. **Front-end keys.** Put the Project URL and the **anon** key in `public/config.js`. Never put the
   `service_role` key in any file under `public/`. If both values are empty the page runs in demo mode. The public Deriv OAuth client ID is configured separately in `DERIV_OAUTH_CLIENT_ID`; never put OAuth access tokens or Supabase service keys in this file.
4. **Make yourself admin.** Sign in once, then in the SQL editor:
   `insert into public.admins select id from auth.users where email = 'you@gmail.com';`
5. **Edge Function secrets.** Copy `.env.example` to `.env`, fill it in, then
   `supabase secrets set --env-file .env` and
   `supabase functions deploy domain-check checkout mpesa-callback`.
   (`mpesa-callback` is public by design: `supabase/config.toml` sets `verify_jwt = false`.)
6. **Safaricom Daraja.** Create an app at developer.safaricom.co.ke, test on the sandbox, then request go-live for
   your Paybill/Till. The callback URL is built for you:
   `https://<ref>.supabase.co/functions/v1/mpesa-callback?s=<MPESA_CALLBACK_SECRET>`.
7. **Deploy the repository** to Vercel using `vercel.json` so the built apps and shared OAuth backend are available. A static-only upload of `public/` does not provide account login. Set `APP_HOSTS` in `config.js` to the hostnames
   that serve the builder (for example `["app.yourbrand.com"]`).
8. **Prices.** Edit the `pricing` and `tld_prices` tables (the front-end copies are display only).

### Serving client domains (tenant mode)

When `APP_HOSTS` is set, the same `index.html` served on any other hostname looks up
`public_site(<hostname>)` and shows only that client's live site, full screen. On the app host you can preview a
live site with `?site=their-domain.com`. To make a client's domain reach this deployment you add it to your host
(Vercel Domains API, or Cloudflare for SaaS custom hostnames) and tell the client's DNS to point at it. That
step is manual today (it is the "Connect DNS" task in the admin queue). If `APP_HOSTS` is empty the page never
enters tenant mode.

## Tests

```
npm install
npm test                 # platform tests: database, payments, domain logic, front-end flows, admin page
npm run check:functions  # type-checks the Edge Functions with Deno
```

What the tests cover: the real migration run in an in-process Postgres (row level security between clients,
server-side pricing, paid-order idempotency, locked domains, admin-only actions, public site view); M-Pesa and
domain helpers with mocked network calls; the front-end driven in jsdom against a fake Supabase client (sign-in,
profile, autosave, taken-domain blocking, order, payment polling, tenant mode, admin page).

## What is NOT tested or NOT built (read before taking real money)

* **Nothing has run against a real Supabase project, real Google OAuth, or real Safaricom.** The Edge Functions
  type-check and their pure logic is unit-tested, but the request handlers have not been exercised end to end.
  Test the whole payment path on the Daraja sandbox first, including a cancelled prompt and a wrong amount.
* **Domain availability is best-effort.** RDAP is free but not authoritative, and many country endings have no
  RDAP (those return "manual": the client is told you confirm it after payment). The registrar's own check at
  purchase time is the real answer. Decide your refund process for a domain that turns out to be unavailable.
* **Domain registration and DNS are manual.** The admin queue lists the steps. Register domains in the client's
  name. A registrar API integration is the next automation.
* **Card payments are not built.** The schema has `provider = 'card'`; you still need to choose a gateway.
* **Client site workspace.** Templates, backgrounds, headers, social links, a live Deriv market dashboard, and Analysis, Smart Trading, Strategy Notes, Accumulators, Manual, Bulk Trades, Charts, Free Bots, Tutorials, Markup, and Copy Trading Watchlist panels are available from the tenant site navigation. Public ticks and history use Deriv's unauthenticated WebSocket endpoint. Bot setup files and personal limits are kept in the visitor's browser. Deriv XML files can be imported into the workspace and opened in Deriv Bot; Pipforge JSON setups can be saved and reloaded here. Bot Builder, Analysis, Smart Trading, Charts and Accumulators now mount the local templates. Public ticks are live; account access and execution require the shared backend setup in [Deriv setup](docs/DERIV_SETUP.md).
* **Earnings.** The `commission_daily` table and the Earnings page are ready, but nothing fills the table yet.
  A scheduled job that reads Deriv's markup reports for each client's app is still to be written and verified
  against Deriv's API scopes. Do not store clients' API tokens without encryption and a clear need.
* **Notifications** (email/SMS after payment, to you and the client) are not built.
* **Legal text** (Terms, Privacy, Risk, Refunds) is draft wording. Have a lawyer review it, and check Kenyan data
  protection registration requirements before collecting phone numbers.
* **Front-end structure.** `public/index.html` grew by layers and is one large file. It works and is tested, but
  it should be split into modules before large changes.
* **Abuse limits.** `domain-check` has a small per-instance rate limit only. Add proper limits before launch.

## Layout

```
public/            index.html (builder + tenant renderer), admin.html, config.js
supabase/migrations/20261107000000_init.sql   schema, RLS, pricing, ordering, fulfilment
supabase/functions/domain-check | checkout | mpesa-callback | _shared
tests/             db, functions, frontend, admin (+ helpers)
.github/workflows/test.yml                     runs the tests on every push
```

## Integrated trading apps

See [Deriv setup](docs/DERIV_SETUP.md) for the tab-to-template map, public feeds, shared OAuth backend, customer-domain callbacks, Vercel settings, and verification limits. Run `npm run build` before production deployment.
