import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  small: { fontSize: 9, color: '#666', marginBottom: 20 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, marginTop: 6, borderTopWidth: 1, borderTopColor: '#333' },
  totalLabel: { fontWeight: 'bold' },
})

export function FinancialReportDocument({
  church,
  range,
  summary,
}: {
  church: { name: string }
  range: { from: string; to: string }
  summary: {
    totalIncome: number
    totalExpense: number
    netBalance: number
    byType: { type: string; total: number }[]
    byCategory: { name: string; total: number }[]
  }
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{church.name} — Financial Report</Text>
        <Text style={styles.small}>
          {new Date(range.from).toLocaleDateString()} – {new Date(range.to).toLocaleDateString()}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Income by type</Text>
          {summary.byType.map((t) => (
            <View key={t.type} style={styles.row}>
              <Text style={{ textTransform: 'capitalize' }}>{t.type.replace('_', ' ')}</Text>
              <Text>KES {t.total.toLocaleString()}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total income</Text>
            <Text style={styles.totalLabel}>KES {summary.totalIncome.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses by category</Text>
          {summary.byCategory.map((c) => (
            <View key={c.name} style={styles.row}>
              <Text>{c.name}</Text>
              <Text>KES {c.total.toLocaleString()}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total expenses</Text>
            <Text style={styles.totalLabel}>KES {summary.totalExpense.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Net balance</Text>
          <Text style={styles.totalLabel}>KES {summary.netBalance.toLocaleString()}</Text>
        </View>
      </Page>
    </Document>
  )
}