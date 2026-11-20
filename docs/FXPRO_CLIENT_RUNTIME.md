# FXPro source migration

The FXPro source is under `client-runtime/fxprotradesite`. It is now the complete runtime for both Pipforge's client preview and published customer domains. Native order: Dashboard, Bot Builder, Trading Hub, Smart Trading, Speed Bot, Charts, Analysis Tool, Free Bots, Portfolio, Forex, Digits, Accumulators, Rise / Fall. DTrader and the nested Smart Trading switcher are removed.

## Migrated execution boundary

- Deriv OAuth and account APIs have one canonical implementation in the Pipforge repository root (`api/deriv.mjs` backed by `scripts/deriv-auth.mjs` and the encrypted Supabase credential store). Do not deploy a second auth server from `client-runtime/fxprotradesite`; customer domains are resolved and authenticated by the shared root API.
- Startup restores `/api/deriv/session`; provider tokens are never returned to the browser. Accounts and fresh account-specific OTP URLs come from the existing encrypted Pipforge BFF.
- Bot Builder, Smart Trading, Speed Bot, Advanced Trading and the native manual terminal share the New API transport. Blockly's internal view-model names are adapted at the boundary, while outgoing requests use New API fields.
- Parameter-based purchases obtain a quote on the selected authenticated connection before buying; account changes invalidate pending work. Duplicate in-flight purchases are rejected. Buy/sell/update/cancel failures are never automatically retried.
- Balance and open-contract subscriptions feed the selected account and existing trade view models. Reconnects request fresh OTP URLs and restore account streams.
- Token management, copy-trading buttons, hidden copy purchases and legacy standalone token tools were removed. The external DTrader credential-forwarding iframe was replaced by local chart and contract controls.
- The old markup tool contained an embedded provider credential. It was removed; its owner should revoke that old credential with Deriv.

## Configuration and verification

The same source migration is published for review in `fxpro254-hue/fxprotradesite`. Its standalone deployment must configure `APP_ORIGIN`, `DERIV_CLIENT_ID`, `DERIV_REDIRECT_URI`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `DERIV_SESSION_ENCRYPTION_KEY`, and use the Pipforge OAuth-session database migration. Register the exact `/api/deriv/callback` URL with Deriv. No secrets belong in source files.

Both copies build with Rsbuild. Pipforge's test suite includes session/account-switch and quote/buy failure tests. Deriv's live schemas validate the representative proposal, buy and open-contract payloads. These are source/build/mocked checks; they do not establish that a configured production account has completed a trade. No real or demo trade was placed.

## Preview and delivery

`npm run build` installs isolated runtime dependencies, builds the frontend, and copies hashed assets into `public/` without overwriting the builder. `fxpro.html` is generated. Deploy output is `site-output/`, excluding static `index.html` so Vercel cannot bypass the host-aware entry function. The function explicitly bundles the original builder and generated runtime HTML. Retired token callbacks, markup tool and service worker are excluded.

`api/site-entry.mjs` serves Pipforge on platform hosts and the trading HTML directly on customer hosts. `/api/client-site` resolves live published sites; unknown domains cannot silently receive a generic trading app.

The builder mounts one complete same-origin runtime through `fxpro-preview.js`. Draft changes travel through a source-and-origin-checked message bridge without remounting the app. Delivered sites load their saved public profile from the backend. Name/logo, palette, font, header, blur, loader, announcement, native menu visibility and social placement are applied by `src/pipforge/site-branding.ts` and `styles/pipforge-tenant.scss`. Both modes reuse the builder background animation engine exported by `scripts/export-client-backgrounds.mjs`. Dialog surfaces stay readable.

The previous per-tab renderer is no longer mounted or built for delivery. Its compatibility source remains for existing builder handlers. Keep provider credentials out of the public profile.

Verification covers build, saved-profile/bridge/routing tests and public browser navigation. Authenticated demo purchases, external premium/community services and production account permissions still require live verification. Passing tests do not prove a successful trade.

## Shared template execution

The three supplied Next.js templates are built into `/apps/digits/`, `/apps/accumulators/`, and `/apps/rise-fall/`. In the FXPro shell they borrow the parent's selected account and authenticated DerivWS through a same-origin host interface. A borrowed connection releases its own subscriptions on page exit; it cannot disconnect the app's owner. Templates do not mint a second OTP or keep another login state. Their standalone deployments retain the normal backend OAuth flow.

Bot Builder generates an account identifier, not an access token. Startup validates that identifier against the selected session, requests a fresh balance, and rejects a changed account. Reporting-stream failures do not sign out an otherwise verified connection. Fixed-price proposals without stream IDs can be bought once on their owning authenticated connection while freshness and account-generation checks remain enforced.

The account header always uses Deriv currency/demo SVGs and Real/Demo dropdown tabs. The former account-display design choices are removed. Gold brand declarations and semantic variables inherit the client accent; status/error colors keep their meaning. `tests/fixtures/mock-runtime-server.mjs` offers an isolated account UI fixture that forwards only public market reads; every order is intercepted and recorded locally. It must never be deployed as a production server.
