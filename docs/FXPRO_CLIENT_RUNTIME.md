# FXPro source migration

The FXPro source is under `client-runtime/fxprotradesite`. It is now the complete runtime for both Pipforge's client preview and published customer domains. Native order: Dashboard, Bot Builder, DTrader, Smart trading, Analysis Tool, Free Bots, Portfolio, Forex. Smart trading retains Trading Hub, Smart Trading, Speed Bot and Charts.

## Migrated execution boundary

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

The builder mounts one complete same-origin runtime through `fxpro-preview.js`. Draft changes travel through a source-and-origin-checked message bridge without remounting the app. Delivered sites load their saved public profile from the backend. Name/logo, palette, font, header, blur, loader, announcement, account display, native menu visibility and social placement are applied by `src/pipforge/site-branding.ts` and `styles/pipforge-tenant.scss`. Both modes reuse the builder background animation engine exported by `scripts/export-client-backgrounds.mjs`. Dialog surfaces stay readable.

The previous per-tab renderer is no longer mounted or built for delivery. Its compatibility source remains for existing builder handlers. Keep provider credentials out of the public profile.

Verification covers build, saved-profile/bridge/routing tests and public browser navigation. Authenticated demo purchases, external premium/community services and production account permissions still require live verification. Passing tests do not prove a successful trade.
