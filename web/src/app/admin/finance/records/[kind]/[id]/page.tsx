import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/guard'
import { userCan } from '@/lib/auth/permissions'
import { financeEngine } from '@/lib/services/finance.service'
import {
  FinanceError,
  financeCategory,
  financeMoney,
  financePaymentLabel,
  SOURCE_LABELS,
} from '@/lib/finance'
import { BackLink } from '@/components/shared/BackLink'
import { GivingDownloadButton } from '@/components/finance/GivingDownloadButton'
import {
  FinanceDocumentUpload,
  FinanceRecordActions,
} from '@/components/finance/FinanceRecordActions'
import { FinanceAuditTable } from '@/components/finance/FinanceAuditTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function FinanceRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { churchId, user, role } = await requirePermission('finance:read'),
    { kind, id } = await params,
    search = await searchParams
  const engine = financeEngine()
  let data
  try {
    data = await engine.entry(user.id, churchId, kind, id)
  } catch (e) {
    if (e instanceof FinanceError && [400, 404].includes(e.status)) notFound()
    throw e
  }
  const { entry, documents, audit } = data,
    canWrite = await userCan(churchId, role, 'finance:write')
  const details: [string, string | null][] = [
    ['Donor / payee', entry.payee],
    ['Category', financeCategory(entry)],
    [
      'Status',
      entry.status === 'completed'
        ? entry.direction === 'expense'
          ? 'Paid'
          : 'Received'
        : entry.status,
    ],
    [
      'Payment / bill date (EAT)',
      new Date(entry.occurred_at).toLocaleString('en-GB', {
        timeZone: 'Africa/Nairobi',
      }),
    ],
    ['Payment method', financePaymentLabel(entry)],
    ['Source', SOURCE_LABELS[entry.source]],
    ['Payment reference', entry.reference],
    ['Invoice / bill', entry.invoice_number],
    ['Invoice date', entry.invoice_date],
    ['Due date', entry.due_date],
    [
      'Service / salary period',
      entry.period_start
        ? `${entry.period_start} to ${entry.period_end || entry.period_start}`
        : null,
    ],
    ['Campaign', entry.campaign_name],
    ['Recorded by', entry.recorded_by_name],
    [
      'Recorded at (EAT)',
      new Date(entry.created_at).toLocaleString('en-GB', {
        timeZone: 'Africa/Nairobi',
      }),
    ],
    ['Statement reference', entry.reconciliation_reference],
    ['Change reason', entry.change_reason],
  ]
  return (
    <div className="space-y-6">
      <BackLink
        href={
          kind === 'expense'
            ? '/admin/finance/expenses'
            : '/admin/finance/transactions'
        }
        label="Finance records"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {entry.voucher_number || 'Finance record'}
          </h1>
          <p className="mt-1 text-xl font-semibold">
            {financeMoney(entry.amount, entry.currency)}
          </p>
        </div>
        <div className="flex gap-2">
          <GivingDownloadButton
            url={`/api/finance/entries/${kind}/${id}/voucher?churchId=${churchId}`}
            label="Download record PDF"
          />
          {kind === 'giving' &&
            ['completed', 'test'].includes(entry.status) && (
              <GivingDownloadButton
                url={`/api/giving/receipts/${id}?churchId=${churchId}`}
                label="Giving receipt"
              />
            )}
        </div>
      </div>
      {search.attachment === 'failed' && (
        <p role="alert" className="rounded-lg border p-4 text-sm">
          The finance record was saved, but its attachment could not be
          uploaded. Add the document below.
        </p>
      )}
      {entry.status === 'voided' && (
        <p className="rounded-lg bg-destructive/10 p-4 text-sm">
          This record is voided and excluded from financial totals. Its original
          details and history are retained.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {entry.kind === 'giving'
                ? financeCategory(entry)
                : entry.description}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              {details
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{value}</dd>
                  </div>
                ))}
            </dl>
            {entry.notes && (
              <div className="border-t pt-4">
                <h2 className="text-sm font-medium">Filing notes</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {entry.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Supporting documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="rounded-md border p-3">
                <a
                  className="break-words text-sm text-primary underline"
                  href={`/api/finance/documents/${doc.id}?churchId=${churchId}`}
                >
                  {doc.file_name}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(doc.size_bytes / 1024).toFixed(0)} KB · Filed by{' '}
                  {doc.uploaded_by_name} ·{' '}
                  {new Date(doc.created_at).toLocaleDateString('en-GB', {
                    timeZone: 'Africa/Nairobi',
                  })}
                </p>
              </div>
            ))}
            {!documents.length && (
              <p className="text-sm text-muted-foreground">
                No documents filed yet.
              </p>
            )}
            {entry.legacy_receipt_url &&
              /^https?:\/\//i.test(entry.legacy_receipt_url) && (
                <a
                  href={entry.legacy_receipt_url}
                  rel="noreferrer"
                  target="_blank"
                  className="block text-sm text-primary underline"
                >
                  Open previously filed receipt
                </a>
              )}
            {canWrite && <FinanceDocumentUpload entry={entry} />}
          </CardContent>
        </Card>
      </div>
      {canWrite && (
        <FinanceRecordActions key={entry.updated_at} entry={entry} />
      )}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Change history</h2>
          <GivingDownloadButton
            url={`/api/finance/report?churchId=${churchId}&report=audit&format=csv&entityType=${kind}&entityId=${id}`}
            label="Download full history"
          />
        </div>
        <FinanceAuditTable rows={audit.rows} />
        {audit.total > audit.rows.length && (
          <Link
            className="text-sm text-primary underline"
            href={`/admin/finance/history?entityType=${kind}&entityId=${id}`}
          >
            Review all {audit.total} changes
          </Link>
        )}
      </section>
    </div>
  )
}
