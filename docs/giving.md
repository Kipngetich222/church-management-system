# Church giving

Super admins configure receiving details at **Admin → Giving settings** (`/admin/settings/giving`). Members give at `/member/giving` using only an amount, Kenyan M-Pesa phone number and giving type. Finance admins view the church history at `/admin/finance/offerings`.

The current payment integration is **Safaricom Daraja**. Destination setup covers all four requested types, but direct STK collection is available only for enabled paybills and tills. Pochi and personal-number collection require a compatible provider integration; saving those numbers does not enable an STK route.

| Destination          | Setup                                                          | STK support in this release                                    |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Paybill              | Paybill number, optional account reference, Daraja credentials | Available with an STK-enabled merchant account                 |
| Buy goods till       | Receiving till, STK business shortcode, Daraja credentials     | Available; the till and business shortcode may differ          |
| Pochi la Biashara    | Kenyan receiving phone number                                  | Saved as a disabled destination; provider integration required |
| Direct mobile number | Kenyan receiving phone number                                  | Saved as a disabled destination; provider integration required |

Daraja's paybill/till transaction types must not be used to simulate person-to-person or Pochi payments. Provider wallet collection and later payouts are different payment flows and have not been implemented here. [PayHero's published channel API](https://docs.payhero.co.ke/) lists paybill, till and bank collection; [IntaSend's payout providers](https://developers.intasend.com/guides/send-money/providers/) describe separate payout rails. Neither is assumed to provide direct Pochi STK collection.

## Deployment

1. Apply all existing migrations, then **0045_giving_categories.sql** and **0046_giving_payments.sql**, in order. The category enum change must commit before the payment migration.
2. Configure a stable `GIVING_CREDENTIALS_KEY` on both the web host and API host: 32 random bytes encoded as 64 hex characters. Use the same value on both hosts. Credentials and pending-payment snapshots depend on this key; do not replace it during normal deployments.
3. Set the web host's `NEXT_PUBLIC_APP_URL` and the API host's `API_PUBLIC_URL` to their public HTTPS origins. Safaricom cannot deliver callbacks to localhost. Keep Supabase service-role credentials server-side.
4. As a church super admin, save the receiving number, environment and the church's own Daraja consumer key, consumer secret and STK passkey. For a till, enter the STK business shortcode separately. Leave the account reference blank for a generated reference, or enter up to 12 letters, digits, spaces or hyphens.
5. Start with **Sandbox** and enable giving. Enabling checks the connection's OAuth credentials without sending a payment prompt. Verify an actual sandbox payment before switching to **Production** and supplying production credentials. Only a provider test can verify the shortcode/passkey/till association.

The global `MPESA_*` configuration is not used as a fallback destination for church giving. Each church owns its receiving setup. A change to the church settings does not change the destination, environment or credentials saved with an existing payment attempt.

Production deployment, credentials and a live STK transaction must be checked in the target environment. Automated tests use isolated PostgreSQL and substituted HTTP transports; they do not charge a phone or write to the hosted database.

## Payment and receipt behavior

- Categories: offering, tithe, mission, building fund, project fund, thanksgiving, compassion, other, and legacy pledge payments. `welfare` remains the stored identifier for compassion to retain existing records.
- STK amounts are whole Kenyan shillings from KES 1 to 250,000. Local `07…`/`01…`, national and `+254…` numbers normalize to the provider's Kenyan format. Other countries are rejected for this M-Pesa integration.
- A client-generated `requestId` identifies each attempt. Retry the same attempt with the same ID and values. The database prevents more than one unresolved attempt per member and church.
- The attempt is saved before requesting an STK prompt. Acceptance of a prompt is not a completed gift. Only an authenticated query for the exact checkout can credit the ledger.
- Callbacks carry an unpredictable per-attempt token; the database stores its hash. Successful callback metadata must match the requested amount and payer. Early callbacks, replayed callbacks and simultaneous status checks cannot create multiple offerings or receipts.
- An uncertain network response stays pending/review. It is not automatically retried or counted as income. If no checkout identifier was received, investigate the account reference in the merchant's records before authorizing another payment.
- Confirmed gifts generate unique receipt codes. Receipts include church identity and the available uploaded logo, donor and payer details, amount, category, payment destination, date in East Africa Time and the M-Pesa receipt when received. Receipt identity is retained if a membership is removed.
- Sandbox confirmations produce **TEST** receipts and are excluded from income, dashboard figures and campaign/pledge totals.
- Members can read/download their own records. Active admins with `finance:read` or `finance:*` can access church history; setup changes require a super admin. Authenticated database clients cannot read raw credentials/payment attempts or invoke payment confirmation.
- History is paginated, with giving-type, status and inclusive Nairobi-date filters. CSV downloads traverse every matching record using stable creation-time cursors, without the former 20/500-row truncation. Spreadsheet formula characters are escaped. PDF receipts are generated only for completed or explicitly marked test gifts.

Legacy records created by the old implementation with an awaiting/failure note or `MPESA-…` reference are retained as **Needs review** or **Failed**. They lose premature receipt numbers and no longer count as received funds. Because those records lack the provider checkout ID, the migration does not invent a successful confirmation.

## Endpoints

Nest routes use `/api/v1`; all authenticated routes require a Supabase bearer token. Except initiation, pass `churchId` as a query parameter.

| Method    | Path                                  | Result                                                                                       |
| --------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| POST      | `/giving/mpesa`                       | Initiate or recover `{ churchId, requestId, amount, phone, type }`                           |
| GET / PUT | `/giving/settings`                    | Sanitized setup / super-admin setup update                                                   |
| GET       | `/giving/payments/:id`                | Authorized payment status                                                                    |
| POST      | `/giving/payments/:id/verify`         | Query and reconcile a payment                                                                |
| GET       | `/giving/history`                     | `scope=mine` (default) or `scope=church`; `page`, `pageSize`, `type`, `status`, `from`, `to` |
| GET       | `/giving/export`                      | Complete filtered CSV, with the same scope/filters                                           |
| GET       | `/giving/receipts/:id`                | Confirmed receipt data for mobile/API consumers                                              |
| POST      | `/giving/mpesa/callback?id=…&token=…` | Provider callback; no user login                                                             |

The web uses corresponding cookie-authenticated `/api/giving/...` routes. Its receipt endpoint returns a downloadable PDF. Its canonical callback is `/api/giving/callback`; `/api/giving/mpesa/callback` also resolves to that handler for URL compatibility. An old callback without an issued token cannot confirm a payment.

The web form queries payment status for up to two minutes and offers a manual status check afterwards. History can also check unresolved payments. Scheduled reconciliation is available at web `GET /api/cron/giving-payments` (bearer `CRON_SECRET`) and Nest `POST /api/v1/cron/giving-payments` (the API cron secret guard). The web's existing daily maintenance job includes this backstop. For prompt recovery from missed callbacks on a busy deployment, call reconciliation every minute with an external scheduler; each run checks up to five pending checkouts.

## Verification

At the repository root, run `npm test -- --runInBand` and `npm run test:giving-db`. In `web/`, run `npm run test:giving`, `npm run typecheck`, and the isolated production build. Tests cover callback correlation and races, provider errors, exact amounts, encryption, permissions, legacy migration, full exports and actual PDF/logo generation.
