import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  financeCategory,
  financeMoney,
  financePaymentLabel,
  SOURCE_LABELS,
  type FinanceEntry,
} from '@/lib/finance'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 48,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#172033',
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  sub: { fontSize: 9, color: '#526077', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#dce2eb',
    paddingVertical: 6,
  },
  date: { width: '16%', paddingRight: 6 },
  details: { width: '49%', paddingRight: 8 },
  amount: { width: '20%', textAlign: 'right', paddingRight: 8 },
  status: { width: '15%' },
  label: { color: '#526077', fontSize: 8, marginTop: 3 },
  section: { marginTop: 14, fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  pair: { marginBottom: 8 },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 36,
    right: 36,
    color: '#6b7280',
    fontSize: 8,
  },
})
export function FinanceRegisterDocument({
  churchName,
  rows,
  period,
  title = 'Finance transaction register',
  filters,
}: {
  churchName: string
  rows: FinanceEntry[]
  period: { from?: string; to?: string }
  title?: string
  filters?: string
}) {
  return (
    <Document title={`${churchName} - ${title}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{churchName}</Text>
        <Text style={styles.section}>{title}</Text>
        <Text style={styles.sub}>
          {period.from || 'Beginning of records'} to{' '}
          {period.to || 'Latest record'} (inclusive, East Africa Time).{' '}
          {rows.length} records.{filters ? ` ${filters}` : ''}
        </Text>
        <Text style={styles.sub}>
          Amounts are shown in each record&apos;s currency. Status identifies
          received or paid, unpaid, voided and test records.
        </Text>
        <View style={styles.row}>
          <Text style={styles.date}>Date / voucher</Text>
          <Text style={styles.details}>
            Category / donor or payee / reference
          </Text>
          <Text style={styles.amount}>Amount</Text>
          <Text style={styles.status}>Status</Text>
        </View>
        {rows.map((row) => (
          <View key={row.entry_key} style={styles.row} wrap={false}>
            <View style={styles.date}>
              <Text>{row.entry_date}</Text>
              <Text style={styles.label}>{row.voucher_number || row.id}</Text>
            </View>
            <View style={styles.details}>
              <Text>
                {financeCategory(row)} - {row.payee || 'Anonymous'}
              </Text>
              <Text style={styles.label}>
                {row.kind === 'giving'
                  ? row.campaign_name || 'Giving'
                  : row.description}
              </Text>
              <Text style={styles.label}>
                {SOURCE_LABELS[row.source]} | {financePaymentLabel(row)}
                {row.reference ? ` | ${row.reference}` : ''}
              </Text>
              {row.invoice_number && (
                <Text style={styles.label}>Invoice: {row.invoice_number}</Text>
              )}
            </View>
            <Text style={styles.amount}>
              {row.direction === 'expense' ? '- ' : ''}
              {financeMoney(row.amount, row.currency)}
            </Text>
            <View style={styles.status}>
              <Text>
                {row.status === 'completed'
                  ? row.direction === 'expense'
                    ? 'Paid'
                    : 'Received'
                  : row.status}
              </Text>
              {row.reconciled_at && (
                <Text style={styles.label}>Reconciled</Text>
              )}
            </View>
          </View>
        ))}
        {!rows.length && (
          <Text style={styles.sub}>No records match this selection.</Text>
        )}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Confidential finance records | East Africa Time | Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
export function FinanceVoucherDocument({
  churchName,
  entry,
}: {
  churchName: string
  entry: FinanceEntry
}) {
  const pairs: [string, string | null][] = [
    ['Record', entry.voucher_number || entry.id],
    [
      'Status',
      entry.status === 'completed'
        ? entry.direction === 'expense'
          ? 'Paid'
          : 'Received'
        : entry.status,
    ],
    ['Amount', financeMoney(entry.amount, entry.currency)],
    [
      'Date (East Africa Time)',
      new Date(entry.occurred_at).toLocaleString('en-GB', {
        timeZone: 'Africa/Nairobi',
      }),
    ],
    ['Category', financeCategory(entry)],
    [
      entry.direction === 'expense' ? 'Paid to / supplier' : 'Received from',
      entry.payee,
    ],
    ['Description', entry.description],
    ['Method', financePaymentLabel(entry)],
    ['Reference', entry.reference],
    ['Source', SOURCE_LABELS[entry.source]],
    ['Invoice', entry.invoice_number],
    ['Invoice date', entry.invoice_date],
    ['Due date', entry.due_date],
    [
      'Service period',
      entry.period_start
        ? `${entry.period_start} to ${entry.period_end || entry.period_start}`
        : null,
    ],
    ['Campaign', entry.campaign_name],
    ['Recorded by', entry.recorded_by_name],
    ['Reconciliation reference', entry.reconciliation_reference],
    ['Last change reason', entry.change_reason],
    ['Notes', entry.notes],
  ]
  return (
    <Document
      title={`${churchName} - ${entry.voucher_number || 'Finance record'}`}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{churchName}</Text>
        <Text style={styles.section}>
          {entry.status === 'voided' ? 'VOIDED - ' : ''}
          {entry.kind === 'expense' ? 'Expense record' : 'Income record'}
        </Text>
        {pairs
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <View key={label} style={styles.pair}>
              <Text style={styles.label}>{label}</Text>
              <Text>{value}</Text>
            </View>
          ))}
        <Text style={styles.sub}>
          Supporting files and the complete change history are held with this
          record. Unpaid or voided records are not proof of payment.
        </Text>
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Record ID: ${entry.id} | Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
