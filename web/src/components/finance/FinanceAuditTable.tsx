import Link from 'next/link'
import type { FinanceAudit } from '@/lib/finance'
import { givingLabel } from '@/lib/giving'
import { PAYMENT_LABELS, SOURCE_LABELS } from '@/lib/finance'

function changes(row: FinanceAudit) {
  const fields: Record<string, string> = {
    amount: 'Amount',
    currency: 'Currency',
    type: 'Giving type',
    method: 'Payment method',
    status: 'Status',
    description: 'Description',
    payee: 'Donor / payee',
    donor_name: 'Donor',
    reference: 'Payment reference',
    receipt_number: 'Receipt',
    voucher_number: 'Voucher',
    category: 'Category',
    category_name: 'Expense category',
    notes: 'Filing notes',
    invoice_number: 'Invoice',
    invoice_date: 'Invoice date',
    due_date: 'Due date',
    period_start: 'Service period from',
    period_end: 'Service period to',
    given_at: 'Received on',
    spent_at: 'Paid on',
    received_at: 'Received on',
    reconciled_at: 'Reconciled on',
    reconciliation_reference: 'Statement reference',
    voided_at: 'Voided on',
    source: 'Source',
    name: 'Name',
    goal_amount: 'Goal',
    amount_pledged: 'Total commitment',
    start_date: 'Start',
    end_date: 'End',
    starts_on: 'Start',
    ends_on: 'Due / end',
    frequency: 'Frequency',
    member_name: 'Member',
    file_name: 'Document',
    mime_type: 'File type',
    size_bytes: 'File size (bytes)',
    uploaded_by_name: 'Filed by',
    recorded_by_name: 'Recorded by',
  }
  const display = (key: string, value: unknown) => {
    if (value == null || value === '') return '—'
    if (key === 'type') return givingLabel(String(value))
    if (key === 'method') return PAYMENT_LABELS[String(value)] || String(value)
    if (key === 'source') return SOURCE_LABELS[String(value)] || String(value)
    if (key.endsWith('_at'))
      return (
        new Date(String(value)).toLocaleString('en-GB', {
          timeZone: 'Africa/Nairobi',
        }) + ' EAT'
      )
    return String(value).replaceAll(key === 'frequency' ? '_' : '\u0000', ' ')
  }
  return Object.entries(fields)
    .filter(
      ([key]) =>
        (row.before_data?.[key] ?? null) !== (row.after_data?.[key] ?? null)
    )
    .map(([key, label]) => ({
      label,
      before: display(key, row.before_data?.[key]),
      after: display(key, row.after_data?.[key]),
    }))
}
export function FinanceAuditTable({ rows }: { rows: FinanceAudit[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <details key={row.id} className="rounded-lg border bg-background p-4">
          <summary className="cursor-pointer text-sm">
            <span className="font-medium">
              {row.action.replaceAll('_', ' ')} · {row.actor_name}
            </span>
            <span className="ml-2 text-muted-foreground">
              {new Date(row.created_at).toLocaleString('en-GB', {
                timeZone: 'Africa/Nairobi',
              })}{' '}
              EAT
            </span>
            <span className="ml-2 text-xs">{row.entity_type}</span>
          </summary>
          {row.reason && <p className="mt-2 text-sm">{row.reason}</p>}
          {['giving', 'expense', 'income'].includes(row.entity_type) && (
            <Link
              className="mt-2 inline-block text-sm text-primary underline"
              href={`/admin/finance/records/${row.entity_type}/${row.entity_id}`}
            >
              Open record
            </Link>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2">Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {changes(row).map((change) => (
                  <tr key={change.label} className="border-t align-top">
                    <td className="p-2 pl-0 font-medium">{change.label}</td>
                    <td className="max-w-96 whitespace-pre-wrap break-words p-2">
                      {change.before}
                    </td>
                    <td className="max-w-96 whitespace-pre-wrap break-words p-2">
                      {change.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      {!rows.length && (
        <p className="py-5 text-sm text-muted-foreground">
          No changes in this selection.
        </p>
      )}
    </div>
  )
}
