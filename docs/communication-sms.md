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
   set `CustomerBuyGoodsOnline` if the provisioned shortcode requires it.
3. Set `SMS_CREDIT_PRICE_KES` to the price charged per SMS part. Bundles contain
   100, 500, 1,000 or 5,000 credits; the total KES price is rounded up to a whole
   shilling and calculated on the server. Choose a price that covers provider
   rates for the destinations the platform supports, taxes and payment fees.
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

Purchasing is disabled until configuration is complete. SMS and M-Pesa must use
the same environment. Sandbox wallets, purchases and campaigns are separate
from production; test credit never becomes live credit. Use a separate test
Supabase project as well when performing payment and SMS acceptance tests.

## Deploy and schedule

### Provider price reference

Africa's Talking's [Bulk SMS Kenya article](https://help.africastalking.com/en/articles/12381163-bulk-sms-kenya),
published 23 September 2025, links its 2025 Kenya price sheet. Checked on
10 November 2026, that sheet lists the following **VAT-exclusive** rates per
SMS part for domestic traffic:

| Provider plan (listed KES band) | Safaricom | Airtel / other Kenyan networks |
| ------------------------------- | --------: | -----------------------------: |
| Basic (0–19,999)                |      0.80 |                           0.80 |
| Plus (20,000–99,999)            |      0.70 |                           0.80 |
| Premium (100,000–399,999)       |      0.60 |                           0.70 |
| Max (400,000+)                  |      0.40 |                           0.60 |

The sheet says 16% VAT is additional. At Basic, 1,000 single-part messages cost
KES 928 including VAT. Sender-ID registration is a separate charge. Confirm
your applicable plan and rates with the provider before setting the platform's
selling price; the reference rates are not automatically applied to church
purchases. `SMS_CREDIT_PRICE_KES` remains the operator's explicit price choice.

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
checkout with an authenticated Safaricom STK Query and credits it exactly once.
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
node --test test/communication.test.mjs
npm run build
```

Before enabling production, perform one real low-value purchase and send with
the configured accounts: approve an STK prompt, verify credit appears once,
send as a department admin, inspect the recipient history and usage balance,
then edit and dispatch a scheduled message. Automated tests use mocked payment
and SMS transports and cannot validate live credentials, provider funding,
sender-ID approval, phone delivery or the deployed cron service.
