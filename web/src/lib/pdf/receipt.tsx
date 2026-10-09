import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  small: { fontSize: 9, color: '#666' },
  section: { marginTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#666' },
  total: { fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
})

export function ReceiptDocument({
  church,
  member,
  offering,
}: {
  church: { name: string; address?: string | null; phone?: string | null; email?: string | null }
  member: { full_name: string; email: string }
  offering: {
    receipt_number: string
    amount: number
    currency: string
    type: string
    method: string
    given_at: string
  }
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{church.name}</Text>
            {church.address && <Text style={styles.small}>{church.address}</Text>}
            {church.phone && <Text style={styles.small}>{church.phone}</Text>}
            {church.email && <Text style={styles.small}>{church.email}</Text>}
          </View>
          <View>
            <Text style={styles.title}>Receipt</Text>
            <Text style={styles.small}>#{offering.receipt_number}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Given by</Text>
          <Text>{member.full_name}</Text>
          <Text style={styles.small}>{member.email}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text>{new Date(offering.given_at).toLocaleDateString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Type</Text>
            <Text style={{ textTransform: 'capitalize' }}>{offering.type.replace('_', ' ')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Method</Text>
            <Text style={{ textTransform: 'capitalize' }}>{offering.method.replace('_', ' ')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.total}>
              {offering.currency} {offering.amount.toLocaleString()}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Thank you for your generous giving. This receipt is auto-generated and does not require a signature.
        </Text>
      </Page>
    </Document>
  )
}