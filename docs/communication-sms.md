# Church communication and SMS setup

Churches share the platform's Africa's Talking account. Each church has its own
prepaid SMS balance. A church super admin buys a bundle using M-Pesa on
`/admin/communication/purchase`; no church needs a provider account or API key.
All active admins can use the church balance. Department admins can send only
to active members of the departments they currently lead, even when choosing a
small group, category, custom list or leaders.

## Central provider and payment setup

1. The platform operator creates and funds **one Africa's Talking application**,
   enables SMS and obtains an API key and any approved sender ID needed for the
   destination countries. Configure `AFRICAS_TALKING_USERNAME`,
   `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_ENV` and optionally
   `AFRICAS_TALKING_SENDER_ID` on both the Next.js and NestJS hosts.
2. Configure the platform's Safaricom Daraja STK Push account on the **web host**:
   `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`,
   and `MPESA_ENV`. `MPESA_TRANSACTION_TYPE` defaults to `CustomerPayBillOnline`;
   set `CustomerBuyGoodsOnline` if the provisioned shortcode requires it. Set
   `MPESA_PARTY_B` to the receiving till/paybill when it differs from the business
   shortcode used for the STK password; otherwise leave it blank.
3. Leave `SMS_CREDIT_PRICE_KES` unset to use **Africa's Talking Kenya Basic**:
   KES 0.80 per SMS part plus 16% VAT, or **KES 0.928**. The server calculates
   bundle totals and rounds up to whole shillings for M-Pesa:

   | SMS credits | Payment (KES, including VAT) |
   | ----------- | ---------------------------: |
   | 100         |                           93 |
   | 500         |                          464 |
   | 1,000       |                          928 |
   | 5,000       |                        4,640 |

   `SMS_CREDIT_PRICE_KES` remains an optional **final VAT-inclusive** override
   for an agreed provider rate, other destinations or a platform margin. No
   payment-fee margin is included in the default. Existing overrides must be
   cleared or set to `0.928` to adopt these prices. Existing purchases keep
   their original amounts. The browser displays server quotes; a stale quote
   is rejected before sending a payment prompt.

4. Set `NEXT_PUBLIC_APP_URL` to the canonical **HTTPS** web URL. Set independent
   random secrets of at least 32 bytes for `SMS_PAYMENT_CALLBACK_SECRET`,
   `SMS_DELIVERY_CALLBACK_SECRET` and `CRON_SECRET`. These stay server-side.
5. In the Africa's Talking application configure its delivery report URL as
   `https://YOUR-WEB-HOST/api/sms/delivery?token=YOUR_SMS_DELIVERY_CALLBACK_SECRET`.
   STK callback URLs are generated per purchase, with a signed token, using
   `/api/sms/purchases/callback`. This is separate from the giving callback.
6. Keep the Africa's Talking application funded centrally. Church M-Pesa
   purchases pay the **platform shortcode** and buy internal prepaid credits.
   They do **not** automatically transfer money into Africa's Talking. The
   operator replenishes that provider balance through its supported funding
   process and monitors it. No church administrator performs this step.

Purchasing is disabled until configuration is complete; the purchase page lists
missing or placeholder credentials, invalid prices and callback URL problems.
SMS and M-Pesa must use the same environment. **Daraja sandbox payments are
simulated and do not provide a real handset STK prompt.** For a real prompt,
configure production Daraja credentials, the production shortcode/passkey,
`MPESA_ENV=production`, `AFRICAS_TALKING_ENV=production`, the live SMS username
and API key, and a public HTTPS app URL reachable by Safaricom. The sandbox SMS
username must be `sandbox`. Sandbox wallets, purchases and campaigns are separate
from production; test credit never becomes live credit. Use a separate test
Supabase project as well when performing payment and SMS acceptance tests.

## Deploy and schedule

### Provider price reference

Africa's Talking's [Bulk SMS Kenya article](https://help.africastalking.com/en/articles/12381163-bulk-sms-kenya),
published 23 September 2025, links its 2025 Kenya price sheet. Checked on
12 November 2026, that sheet lists the following **VAT-exclusive** rates per
SMS part for domestic traffic:

| Provider plan (listed KES band) | Safaricom | Airtel / other Kenyan networks |
| ------------------------------- | --------: | -----------------------------: |
| Basic (0–19,999)                |      0.80 |                           0.80 |
| Plus (20,000–99,999)            |      0.70 |                           0.80 |
| Premium (100,000–399,999)       |      0.60 |                           0.70 |
| Max (400,000+)                  |      0.40 |                           0.60 |

The sheet says 16% VAT is additional. At Basic, 1,000 single-part messages cost
KES 928 including VAT. Sender-ID registration is a separate charge. The default
bundle price applies the Basic rate to all four bundles. A church's bundle size
does not establish the shared platform account's provider plan, so larger
bundles do not automatically receive Plus/Premium/Max discounts. Confirm the
platform account's applicable plan and network mix before setting an override.

### Deployment steps

- Apply `supabase/migrations/0044_communication_wallets.sql` before deploying
  the updated web/API code. It installs isolated wallets, immutable credit
  transactions, purchase confirmation and dispatch functions, audience scoping,
  read policies and audit events. Existing campaign history is preserved;
  historical sends do not create retroactive credit charges.
- Use the same Supabase project and SMS environment on both API hosts. The
  shared dispatch implementation handles browser, API and automated sends.
- The included `web/vercel.json` supports **Vercel Hobby**. It uses two daily
  cron jobs, both scheduled at `0 6 * * *` (06:00 UTC / 09:00 EAT), and enables
  Fluid compute so the existing 300-second function durations fit Hobby's
  Fluid compute limit. Scheduled messages/payment reconciliation and daily
  maintenance run as separate requests with separate time budgets.
- Hobby cron timing is approximate: a 06:00 UTC cron can run between 06:00 and
  06:59 UTC (09:00–09:59 EAT). Only messages already due at that check can be
  dispatched. Later messages wait for the next daily check, and a backlog may
  require additional runs. The app displays this daily-delivery limitation.
  Immediate sends and payment callbacks continue to run when requested.
- Set `CRON_SECRET` in the Vercel production environment. Vercel sends
  `Authorization: Bearer CRON_SECRET` to the protected cron endpoints. Cron jobs
  run on production deployments, not preview deployments.
- For precise scheduled sends while remaining on Hobby, an external scheduler
  can call `/api/cron/scheduled-messages` every minute with that authorization
  header. Once it is active, set `SMS_SCHEDULER_MODE=frequent` and redeploy to
  remove the daily-delivery notice. The setting changes the notice only; it
  does not provision a scheduler. On a paid plan, the same endpoint can use a
  minute-level Vercel cron instead.
- The scheduled route also reconciles pending M-Pesa checkouts if a callback
  is delayed or lost. The buyer can select **Check payment status** too.
- `/api/cron/daily` sends birthday and event reminders and runs deletion
  maintenance. Automated SMS also spends church credits and appears in the
  ledger under its automation name. Deterministic request IDs prevent repeat
  cron calls from sending the same birthday/event reminder again.
- NestJS `/cron/scheduled-messages` uses the same atomic dispatch logic and is
  authenticated with `x-cron-secret`. Only the web scheduler reconciles M-Pesa
  purchases; keep it running even when NestJS also dispatches messages.

## Credit and delivery rules

One credit pays for one SMS part to one distinct normalized phone number.
GSM-7 uses 160 characters for a single part and 153 for multipart messages;
extension characters use two positions. Unicode uses 70 UTF-16 units for one
part and 67 for multipart messages. The preview shows the resulting estimate.
Missing contact details and duplicate addresses are recorded as skipped.

The wallet reserves sufficient credit before contacting the SMS provider.
Accepted submissions consume reserved credit; rejected submissions release it.
A provider timeout or incomplete result retains the reservation and marks the
campaign for review. Such a campaign is never automatically resent. Accepted
does not guarantee handset delivery. Delivery reports update the recipient
history; a later delivery failure does not refund an already billed submission.

Payment callbacks alone cannot mint credit. The server verifies the issued
checkout with an authenticated Safaricom STK Query, checks the echoed checkout
ID, and credits it exactly once. Verification remains available if new purchases
are disabled by a later pricing or SMS credential change. A known checkout ID
is retained for reconciliation if its initial database save fails.
The browser cannot supply the purchase price, edit credit balances, mark a
payment successful or directly modify campaigns. Purchase and message records
retain the original sender's name after their account is deleted.

For interrupted sends/payments shown as **review**, the platform operator must
reconcile the provider records before releasing credit or retrying a payment.
Use `settle_message_batch` with verified per-message outcomes for held sends;
never change wallet totals directly. For an interrupted STK initiation with no
stored checkout ID, confirm the payment outcome with Safaricom before repairing
the purchase's checkout ID or marking it failed. Keep the supporting provider
reference and reason in the operational audit. The application deliberately
does not guess or automatically resubmit a potentially completed operation.

Explicit Daraja rejections mark the purchase failed and permit a new attempt;
transport failures and incomplete success responses remain under review.
Cancellation and unreachable/expired phone prompts are shown after STK Query
confirms failure. Buyers can check payment status manually; open purchases
also refresh every ten seconds while the page is visible. Payment routes allow
60 seconds for OAuth, STK and database work.

## Verification

Run from the repository root:

```text
npm run typecheck
npm test -- --runInBand
node --test test/communication.database.test.mjs
```

Run from `web`:

```text
npm run typecheck
npm run test:communication
npm run build
npm run build:isolated
```

Vercel installs the web dependencies without the backend's `node_modules`.
The web TypeScript configuration therefore resolves the shared communication
module's Supabase types from `web/node_modules`. Keep that path mapping when
changing the web build configuration. `build:isolated` verifies a fresh copy of
the app outside the repository with only the existing web dependency install
available, then removes the temporary copy. It does not install packages or
modify either dependency installation.

Before enabling production, perform one real low-value purchase and send with
the configured accounts: select 100 credits (KES 93 at the default rate), enter
the payer's Kenyan number, approve the phone's STK prompt, verify credit appears once,
send as a department admin, inspect the recipient history and usage balance,
then edit and dispatch a scheduled message. Automated tests use mocked payment
and SMS transports and cannot validate live credentials, provider funding,
sender-ID approval, phone delivery or the deployed cron service.
