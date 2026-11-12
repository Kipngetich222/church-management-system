import {
  DESTINATION_LABELS,
  givingLabel,
  type GivingHistoryRow,
} from './giving.types'

function csvRow(values: unknown[]) {
  return (
    values
      .map((value) => {
        let text = String(value ?? '')
        // Keep donor-provided names/references from being evaluated by spreadsheets.
        if (/^[\s\uFEFF]*[=+@-]/.test(text)) text = `'${text}`
        return `"${text.replaceAll('"', '""')}"`
      })
      .join(',') + '\r\n'
  )
}
export async function* givingCsv(
  churchName: string,
  rows: AsyncIterable<GivingHistoryRow>
) {
  yield '\uFEFF' +
    csvRow([
      'Church',
      'Receipt code',
      'Date (Africa/Nairobi)',
      'Member',
      'Email',
      'Payer phone',
      'Giving type',
      'Payment method',
      'Destination',
      'Destination number',
      'Amount',
      'Currency',
      'Status',
      'M-Pesa / payment reference',
      'Payment ID',
      'Giving ID',
    ])
  for await (const row of rows)
    yield csvRow([
      churchName,
      row.receipt_number,
      new Date(row.given_at).toLocaleString('en-GB', {
        timeZone: 'Africa/Nairobi',
        hour12: false,
      }),
      row.donor_name,
      row.donor_email,
      row.phone,
      givingLabel(row.type),
      row.method,
      row.destination_type ? DESTINATION_LABELS[row.destination_type] : '',
      row.destination_number,
      Number(row.amount).toFixed(2),
      row.currency,
      row.status,
      row.reference,
      row.payment_id,
      row.offering_id,
    ])
}
