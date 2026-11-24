# Premium launch requirements

Status: proposed package, not enabled for sale. Existing $200 orders and entitlements remain unchanged.

## Packages

Regular: $200 one-time setup. Include branding choices, mobile layout, existing free bot library, DNS setup instructions, Deriv OAuth setup, and installation support at no extra charge.

Premium: $300 one-time setup. Include everything in Regular, priority one-to-one contact for change requests, a premium education/community channel, and a tenant-managed catalogue of 20 paid bots. Agree support scope and response hours before publishing; contact availability does not mean unlimited custom development.

Copy trading is pending verification of a supported provider integration. Do not expose the old token tools or sell this as available yet.

No claims of guaranteed profit, fake sales counts or resetting countdowns. A promotional deadline must be a single configured timestamp enforced in checkout. The requested $300/$450 comparison prices need a truthful basis; until then show package prices without fictitious previous prices. Use “recommended” rather than “most chosen” until paid-order counts establish that claim. Extras included in a paid package should say “included at no extra charge”.

## Money and permissions

- Snapshot the selected package and price into each order on the server. A payment amount alone is not a package selector; partial payments must never grant premium.
- Grant premium only after existing admin payment confirmation succeeds. Preserve existing paid sites as Regular unless explicitly upgraded.
- Prevent browsers changing package entitlements through site updates or menu settings.
- Scope bot grants to site, authenticated Deriv account identity and bot ID. A buyer on one domain must not gain access on another domain.
- Let a verified site owner grant/revoke purchased bot access with an audit trail. Never authorize with browser email, user metadata or localStorage.
- Refund/suspension must revoke paid execution access. Revocation must also be checked when a run starts.

## Bot execution decision

Authenticated XML delivery plus an embedded site/account watermark provides attribution and delivery controls. It cannot prevent copying after delivery, even if download/export controls are hidden. A hash is a fingerprint for integrity, not DRM.

To keep source private, retain XML on the server and execute validated strategies there using the buyer's authorized Deriv session. The browser sends settings and receives state, never XML. This requires an execution service with run lifecycle, idempotent purchases, reconnect reconciliation, stop controls, bounded exposure and resource limits. Do not put provider credentials or paid XML in public assets or a public GitHub repo.

## Source audit

`premium-bot-audit.json` records the 20 supplied file hashes, contract fields and block types. Static inspection does not prove trading compatibility or profitability. Eight block names need review: main_account, smartrisk_prepare, smartrisk_query, smartrisk_result, smartrisk_settings, trade, tradeOptions, virtualhook. Some may be converted by backward compatibility hooks; verify each conversion and generator before enabling execution.

Every bot needs demo validation of entry rules, stake progression, stop loss, take profit, repeat purchases, account switching and settlement. Never use a real-money trade to validate migration.

## Inputs still needed

- Private server execution versus browser XML delivery with its copying limitation.
- Real offer end date/time and basis for comparison prices.
- Premium Telegram invite and priority contact details.
