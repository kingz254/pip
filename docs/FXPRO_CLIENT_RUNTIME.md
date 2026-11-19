# FXPro source migration

The FXPro source is under `client-runtime/fxprotradesite`. It is still intentionally separate from Pipforge's current production preview and tenant routing; connecting those is the next integration step.

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

## Next integration step

Build this runtime into Pipforge's output, mount it in the builder preview with draft branding, and route live tenant domains directly to it. Saved name/logo, template, font, blur, header, loader and social preferences already have a first-pass branding bridge, but the full preference matrix and mobile layout must be verified when the runtime is connected. Do not describe that routing or appearance work as deployed yet.
