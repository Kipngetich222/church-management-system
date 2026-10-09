import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  small: { fontSize: 9, color: '#666', marginBottom: 20 },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  colEvent: { width: '55%' },
  colDate: { width: '25%' },
  colCount: { width: '20%', textAlign: 'right' },
  summary: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
})

export function AttendanceReportDocument({
  church,
  range,
  rows,
}: {
  church: { name: string }
  range: { from: string; to: string }
  rows: Array<{
    event_title: string
    event_date: string
    count: number | string
  }>
}) {
  const totalAttendance = rows.reduce((s, r) => s + Number(r.count), 0)
  const avg = rows.length ? Math.round(totalAttendance / rows.length) : 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{church.name} — Attendance Report</Text>
        <Text style={styles.small}>
          {new Date(range.from).toLocaleDateString()} –{' '}
          {new Date(range.to).toLocaleDateString()}
        </Text>

        <View style={styles.headerRow}>
          <Text style={styles.colEvent}>Event</Text>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colCount}>Attendees</Text>
        </View>

        {rows.map((r, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.colEvent}>{r.event_title}</Text>
            <Text style={styles.colDate}>
              {new Date(r.event_date).toLocaleDateString()}
            </Text>
            <Text style={styles.colCount}>{String(r.count)}</Text>
          </View>
        ))}

        <View style={styles.summary}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Summary</Text>
          <Text>Total events: {rows.length}</Text>
          <Text>Total check-ins: {totalAttendance}</Text>
          <Text>Average per event: {avg}</Text>
        </View>
      </Page>
    </Document>
  )
}