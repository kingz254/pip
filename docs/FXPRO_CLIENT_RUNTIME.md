# FXPro app migration into Pipforge client sites

The imported app is a source snapshot under `client-runtime/fxprotradesite`; the sibling checkout remains the editable original. It is not yet a production runtime: Pipforge does not build or route this snapshot to customer domains.

## Main risk found

The FXPro app still initializes Deriv's Legacy API in `src/app/app-root.tsx` and reads its old browser-persisted authorization state through the legacy app shell. Its auth/session code and some embedded tools also assume the FXPro host. Pipforge's supported integration uses New API OAuth, server-held encrypted sessions, per-account OTP WebSockets, and the shared lifecycle in `packages/deriv-core`. Shipping the imported app unchanged would leave client branding and trade authorization inconsistent, and may send some screens back to FXPro.

Do not route customer domains to this build until the remaining New API trade paths have been moved to the Pipforge session and trade lifecycle. A Deriv login, balance read, or successful build alone does not prove that a purchase, contract monitoring, and settlement work.

## Foundation now in Pipforge

- `GET /api/client-site` resolves the request host through the existing live-site lookup, returns only an explicit list of public presentation fields, and is never cacheable. It does not return owner, payment, order, contact, or credential data.
- The public site profile now carries the saved blur value. Pipforge saves the slider value and loads it back with the rest of the site's design.
- The imported app waits for the host's client profile before mounting. It applies the saved site name/logo, template palette and contrast, font, blur/glass variables, background choice, header style, and configured social profiles; the loader is client-named and uses the chosen loader style.
- The original `fxprotradesite` checkout was not edited. Its existing local changes remain intact.

## Remaining work before a customer handoff

1. Build this React app into Pipforge's Vercel output and route registered customer hosts directly to it while leaving Pipforge's own host on the site builder.
2. Replace the imported app's Legacy API auth and trade calls with Pipforge's New API auth/session and shared `deriv-core` lifecycle. Keep separate demo/real accounts and ensure proposal, buy, open-contract updates, reconnect, and settlement use the currently selected account.
3. Replace remaining FXPro-host links and any embedded FXPro-only services with same-domain or Pipforge-backed routes.
4. Match the selected background animations and all header/menu/social placements against the builder, then verify desktop and mobile on a real tenant host.
5. Only after the above, publish the runtime and enable customer-domain routing.

The current background layer is a first pass in the imported app and uses the saved background key with CSS effects; it does not yet reuse Pipforge's full canvas animation renderer. The saved design profile is live-site-only at this endpoint, so the builder preview remains on its existing preview pipeline until the runtime is integrated into that preview.
