import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  financeMoney,
  PAYMENT_LABELS,
  type FinancePeriod,
  type FinanceSummary,
} from '@/lib/finance'
import { givingLabel } from '@/lib/giving'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#172033',
  },
  title: { fontSize: 19, fontWeight: 'bold', marginBottom: 6 },
  sub: { fontSize: 9, color: '#526077', marginBottom: 10 },
  section: { marginTop: 15, marginBottom: 7, fontSize: 12, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e1e6ed',
    paddingVertical: 5,
  },
  label: { width: '65%' },
  value: { width: '35%', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#6b7280',
  },
})
export function FinancialReportDocument({
  church,
  period,
  summary,
}: {
  church: { name: string }
  period: FinancePeriod
  summary: FinanceSummary
}) {
  const currency = summary.currency
  const line = (label: string, amount: number) => (
    <View key={label} style={styles.row} wrap={false}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{financeMoney(amount, currency)}</Text>
    </View>
  )
  return (
    <Document title={`${church.name} - Financial report`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{church.name}</Text>
        <Text style={styles.section}>Financial report</Text>
        <Text style={styles.sub}>
          {period.from} to {period.to} (inclusive, East Africa Time) | Currency:{' '}
          {currency}
        </Text>
        <Text style={styles.sub}>
          Cash basis: received income and paid expenses. Pending, failed, test
          and voided entries are excluded. Unpaid bills are shown separately.
        </Text>
        <Text style={styles.section}>Cash summary</Text>
        {line('Recorded opening balance', summary.openingBalance)}
        {line('Income received', summary.totalIncome)}
        {line('Expenses paid', summary.totalExpense)}
        {line('Net movement', summary.netBalance)}
        {line('Recorded closing balance', summary.closingBalance)}
        <Text style={styles.sub}>
          Opening and closing balances reflect records held in this system. They
          do not assert a verified bank balance. Corrections restate the
          affected period and remain in the change history.
        </Text>
        <Text style={styles.section}>Income by category</Text>
        {summary.byType.map((r) =>
          line(r.kind === 'giving' ? givingLabel(r.type) : r.type, r.total)
        )}
        {!summary.byType.length && (
          <Text style={styles.sub}>No received income in this period.</Text>
        )}
        <Text style={styles.section}>Expenses by category</Text>
        {summary.byCategory.map((r) => line(r.name, r.total))}
        {!summary.byCategory.length && (
          <Text style={styles.sub}>No paid expenses in this period.</Text>
        )}
        <Text style={styles.section}>Bills at period end</Text>
        {line('Outstanding bills', summary.outstandingBills)}
        {line('Overdue bills', summary.overdueBills)}
        <Text style={styles.section}>Payment methods</Text>
        {summary.byMethod.map((r) => (
          <View style={styles.row} key={r.method} wrap={false}>
            <Text>{PAYMENT_LABELS[r.method] || r.method}</Text>
            <Text>
              In: {financeMoney(r.income, currency)} | Out:{' '}
              {financeMoney(r.expense, currency)}
            </Text>
          </View>
        ))}
        <Text style={styles.section}>Monthly movement</Text>
        {summary.monthly.map((r) => (
          <View style={styles.row} key={r.month} wrap={false}>
            <Text>{r.month}</Text>
            <Text>
              In: {financeMoney(r.income, currency)} | Out:{' '}
              {financeMoney(r.expense, currency)}
            </Text>
          </View>
        ))}
        <Text style={styles.section}>Filing and reconciliation</Text>
        <Text style={styles.sub}>
          {summary.completedCount} received or paid records;{' '}
          {summary.automaticCount} captured automatically; {summary.manualCount}{' '}
          entered manually. {summary.unreconciledCount} unreconciled records;{' '}
          {summary.missingDocumentsCount} paid expenses without supporting
          documents; {summary.excludedCount} excluded records.
        </Text>
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Confidential finance report | Generated ${new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi' })} | Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
