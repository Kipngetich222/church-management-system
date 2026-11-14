# Finance

Open **Admin → Finance** (`/admin/finance`) for the cash summary, transactions, giving, expenses and bills, other income, pledges, campaigns, budgets, and change history.

## Setup

Apply the repository migrations in order through **0048_finance_reporting.sql** before deploying the finance pages and API. In particular:

1. **0045** and **0046** establish giving categories and confirmed payments. The category enum migration must commit before the payment migration.
2. **0047_finance_records.sql** adds bills, other income, budgets, supporting documents, audit history, and payment capture. It retains existing records and imports confirmed production SMS purchases and event receipts with known amounts.
3. **0048_finance_reporting.sql** adds the combined register, campaign/pledge/budget progress, and financial summary.

Migration 0047 creates the private `finance-documents` storage bucket. Keep the Supabase service-role key on the server. Both applications use the shared finance engine under `src/modules/finance`, so deployments of `web/` must retain the repository's `src/` source directory. No additional finance-specific environment variables are required. Online giving requires the configuration in [giving.md](giving.md).

Active church admins need `finance:read` to view records, reports, and supporting documents, and `finance:write` to record or change them. `finance:*` grants both. Members can view their own giving and pledges and the church's campaigns. A membership in another church does not grant access.

## Recording and filing

| Page             | Use                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Giving           | Record cash and gifts received outside the payment integration; optionally link a member, campaign, and pledge.       |
| Expenses & bills | Record a paid cost or an unpaid bill, with supplier/employee, category, invoice, due date, and service/salary period. |
| Other income     | Record grants, fundraising receipts, rental income, bank interest, and other non-giving income.                       |
| Transactions     | Search and filter the combined register, then open an individual record to see its files and history.                 |

Amounts must be positive with at most two decimal places. Select a three-letter currency code; reports and plan progress keep currencies separate. Payment times use East Africa Time. Future payments should be recorded as unpaid bills.

An unpaid bill does not count as spending until **Mark bill paid** records its actual payment date, method, and reference. The register uses `completed` for paid expenses and received income; `unpaid` identifies bills still awaiting payment.

Attach PDF, JPEG, or PNG documents up to 10 MB each. More documents can be attached after saving. If an attachment fails, the saved record remains available and its page offers another upload. Newly uploaded files are private; download links require finance access and expire after 60 seconds.

The **Supporting documents** filter distinguishes **Missing documents** from **Documents filed**, including receipts filed before the new upload feature. The overview's missing-documents link opens paid expenses without documents in the selected period and currency. Pagination and CSV/PDF downloads retain these filters.

## Corrections and statement checks

Open a transaction to update filing notes, reconcile it against a bank/M-Pesa/cash statement, undo reconciliation, or void an incorrect manual record. Changes require a reason. Reconciliation also requires a statement reference.

To correct an amount, currency, allocation, payment date, or payment method, void the incorrect manual record and record a replacement. Voiding removes it from totals and retains the original details, receipt identity, documents, and history. When money actually changes hands as a refund, record that movement separately. System-generated payments retain their original amount and identity.

Every change has a before/after snapshot and actor. **Change history** supports date and record filters and a complete CSV export. If another person changes a record while it is open, refresh before saving again.

## Automatic payments and plans

- Confirmed production online gifts count as giving. Sandbox, pending, failed, review, and voided records are excluded from cash totals.
- Confirmed production SMS credit purchases count as expenses once; sending messages does not create another expense. An exact existing manual M-Pesa expense can be linked during capture. Review ambiguous historical matches against statements.
- Paid event registrations with a known received amount count as other income. Marking a paid registration refunded records a separate expense. Recording or cancelling a booking alone is not a payment or refund.
- Campaign progress sums completed gifts in the campaign currency. Campaigns can be paused, completed, or cancelled.
- A pledge records the total commitment, with an optional installment schedule. Only gifts linked to the pledge reduce its outstanding balance. A pledge itself is not income.
- Budgets compare paid expenses in the selected category, currency, and inclusive period. Active budgets for the same category and currency cannot overlap. Cancel a budget or pledge to replace an incorrect plan; its payments and history remain available.

## Reports

Select inclusive **From** and **To** dates and one currency. The default is the current year through today in KES. Reports include cash received, expenses paid, net movement, recorded opening/closing balances, unpaid and overdue bills at period end, payment methods, categories, and monthly totals.

An invoice paid after the selected period is still an outstanding bill at that period's end. Opening and closing balances reflect the records held in this system; use statement reconciliation to compare them with actual accounts. Voids restate the affected period and remain visible in history.

Summary reports download as CSV or PDF. Transaction downloads include every matching record, independently of the current page. Each record also has a PDF voucher; completed/test giving has a separate receipt, with test receipts clearly marked.

## API contracts

Nest routes use `/api/v1/churches/:churchId/finance` and a Supabase bearer token. The web uses cookie-authenticated `/api/finance` routes, with `churchId` in query parameters or the creation body.

| Operation                | Nest path after the finance prefix                    | Web path after `/api/finance`                                 |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| Combined register        | `GET /transactions`                                   | `GET /transactions`                                           |
| Record a transaction     | `POST /offerings`, `/expenses`, or `/income`          | `POST /entries` with `kind: giving`, `expense`, or `income`   |
| Record details / changes | `GET` / `PATCH /entries/:kind/:id`                    | Same, plus `churchId` in the query                            |
| Cash summary             | `GET /summary`                                        | `GET /summary`                                                |
| Transaction CSV          | `GET /export`                                         | `GET /report?report=transactions&format=csv`                  |
| Audit list / CSV         | `GET /audit` / `GET /audit/export`                    | `GET /audit` / `GET /report?report=audit&format=csv`          |
| Plans                    | `GET` / `POST /campaigns`, `/pledges`, `/budgets`     | `GET /plans?kind=…` / `POST /plans` with `kind`               |
| Plan status              | `PATCH /plans/:kind/:id`                              | Same, plus `churchId` in the query                            |
| Supporting upload        | `POST /entries/:kind/:id/documents`, multipart `file` | `POST /documents`, multipart `churchId`, `kind`, `id`, `file` |
| Supporting download      | `GET /documents/:id` returns a signed URL             | `GET /documents/:id?churchId=…` redirects to a signed URL     |

Creation requires a client-generated UUID `requestId`. Keep the same ID and details when retrying an uncertain response. A retry returns the existing record; different details under the same ID are rejected. Omitted default dates retain their saved values even if the retry occurs after midnight.

Transaction changes require `action` (`pay`, `notes`, `void`, `reconcile`, or `unreconcile`), `reason`, and `expectedUpdatedAt` from the latest record's `updated_at`. Plan changes require `status`, `reason`, and `expectedUpdatedAt`.

Register filters: `from`, `to`, `currency`, `kind`, `status`, `source`, `method`, `type`, `categoryId`, `campaignId`, `reconciled=yes|no`, `documents=missing|attached`, and `search`. Lists return `{ rows, total, page, pageSize }`; pages start at 1 and page sizes are 1–100. Summary reports use only dates and currency. Web transaction exports support PDF as well as CSV; plan exports are at `/api/finance/plans/export?churchId=…&kind=…`.

## Verification

At the repository root:

```sh
npm test -- --runInBand finance
npm run test:finance-db
npm run lint
npm run typecheck
npm run build
```

In `web/`:

```sh
npm run test:finance
npm run lint
npm run typecheck
npm run build:isolated
```

Tests exercise the real migrations in isolated PostgreSQL, finance authorization, exact totals, bill payments, retry recovery, attachments, filtered exports, and actual PDF rendering. They do not write to a hosted church database or initiate real payments.
