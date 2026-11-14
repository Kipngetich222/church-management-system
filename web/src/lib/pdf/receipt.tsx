import React from 'react'
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import {
  DESTINATION_LABELS,
  givingLabel,
  type ReceiptDetails,
} from '@/lib/giving'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#172d25',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    paddingBottom: 22,
    borderBottomWidth: 2,
    borderBottomColor: '#256348',
  },
  church: { flexGrow: 1, flexShrink: 1 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  logo: { width: 60, height: 60, objectFit: 'contain', marginBottom: 10 },
  small: { fontSize: 9, color: '#526259', marginTop: 4 },
  section: { marginTop: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dce5df',
  },
  label: { color: '#526259', width: '40%' },
  value: { width: '60%', textAlign: 'right' },
  amount: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    marginTop: 14,
  },
  test: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#fff3cf',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#526259',
    textAlign: 'center',
  },
})
type Offering = {
  id: string
  receipt_number: string
  amount: number
  currency: string
  type: string
  method: string
  given_at: string
  status: string
  reference: string | null
}
export function ReceiptDocument({
  details,
  offering,
  logo,
}: {
  details: ReceiptDetails
  offering: Offering
  logo?: string
}) {
  const test = offering.status === 'test'
  const rows = [
    [
      'Date (East Africa Time)',
      new Date(offering.given_at).toLocaleString('en-GB', {
        timeZone: 'Africa/Nairobi',
        hour12: false,
      }),
    ],
    ['Giving type', givingLabel(offering.type)],
    ...(details.campaign_name ? [['Campaign', details.campaign_name]] : []),
    ...(details.pledge_id ? [['Pledge', details.pledge_id]] : []),
    [
      'Payment method',
      offering.method === 'mpesa'
        ? 'M-Pesa'
        : offering.method.replaceAll('_', ' '),
    ],
    ['Status', test ? 'Sandbox test completed' : 'Completed'],
    ...(details.phone ? [['Payer phone', details.phone]] : []),
    ...(details.destination_type && details.destination_number
      ? [
          [
            'Received through',
            `${DESTINATION_LABELS[details.destination_type]} ${details.destination_number}`,
          ],
        ]
      : []),
    ...(details.account_reference
      ? [['Account reference', details.account_reference]]
      : []),
    ...(offering.reference
      ? [
          [
            offering.method === 'mpesa'
              ? 'M-Pesa receipt'
              : 'Payment reference',
            offering.reference,
          ],
        ]
      : []),
  ]
  return (
    <Document
      title={`${test ? 'Test receipt' : 'Giving receipt'} ${offering.receipt_number}`}
      author={details.church.name}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.church}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo && <Image src={logo} style={styles.logo} />}
            <Text style={styles.title}>{details.church.name}</Text>
            {details.church.address && (
              <Text style={styles.small}>{details.church.address}</Text>
            )}
            {details.church.phone && (
              <Text style={styles.small}>{details.church.phone}</Text>
            )}
            {details.church.email && (
              <Text style={styles.small}>{details.church.email}</Text>
            )}
          </View>
          <View>
            <Text style={styles.title}>Giving receipt</Text>
            <Text style={styles.small}>{offering.receipt_number}</Text>
          </View>
        </View>
        {test && (
          <Text style={styles.test}>
            TEST RECEIPT — No money was received. Excluded from church income.
          </Text>
        )}
        <View style={styles.section}>
          <Text style={styles.small}>Given by</Text>
          <Text>{details.donor.full_name}</Text>
          {details.donor.email && (
            <Text style={styles.small}>{details.donor.email}</Text>
          )}
        </View>
        <View style={styles.section}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
          <Text style={styles.amount}>
            {offering.currency}{' '}
            {Number(offering.amount).toLocaleString('en-KE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
        <Text style={styles.footer}>
          Thank you for supporting {details.church.name}. This receipt was
          generated electronically.{'\n'}
          Giving ID: {offering.id}
        </Text>
      </Page>
    </Document>
  )
}
