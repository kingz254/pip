# Premium packages and bot access

The package uses the existing browser Bot Builder. No persistent worker or extra hosting service is provisioned.

## Owner workflow

1. Configure Regular/Premium prices, optional offer deadline, Telegram invitation and WhatsApp contact in the Pipforge admin page. Offers expire on the server; existing invoices keep their price.
2. The buyer selects a package. An administrator verifies payment using the existing confirmation flow. Payment amount alone does not grant Premium.
3. A paid Premium owner opens **Dashboard → Premium owner tools** in Pipforge. After confirming their own buyer's payment, they select a bot and enter that buyer's exact Deriv account ID to grant access. Repeat for each purchased bot. Access can be revoked from the same form.
4. The buyer signs in through Deriv on that owner's live domain, selects the account that was granted access and opens **Premium Bots**. They load an unlocked bot into Bot Builder, review its settings and press Run.

The API verifies the server session's Deriv account list, live tenant, paid Premium order and matching unrevoked bot grant before delivering XML. Premium XML is stored in a private database table, not public assets or GitHub. Browser roles cannot read the source table directly.

## Limits

- There are 20 catalog entries. Nineteen can be loaded; SMART RISE AND FALL BOT remains disabled because its custom SmartRisk/virtualhook definitions are missing. Static block inspection and source integrity checks do not prove demo execution, strategy correctness or profitability.
- Once XML reaches Bot Builder, a determined buyer can copy it. Revocation blocks future downloads, not copies already loaded. There is no fingerprint, DRM or private server execution.
- These bots run in the browser and require the browser to remain active. They are not unattended hosted strategies.
- Copy trading is not implemented or included. Do not restore old token-sharing tools.
- Priority contact and the Telegram channel are available to paid Premium owners after an administrator configures them. Support scope and response hours should be agreed separately.

## Verification

Tests cover package pricing and expiry, owner-only grants, cross-tenant/account restrictions, unauthenticated requests, private source permissions and authorized delivery. A production runtime build checks bundling. The supplied strategies still need individual demo trade checks, including entry rules, stake progression, stop limits, repeat trades, account switching and settlement. Never validate them with real-money trades.
