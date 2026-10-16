import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  subtitle: { fontSize: 9, color: '#666', marginBottom: 14 },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 5,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    paddingVertical: 4,
  },
  cell: { paddingRight: 6 },
})

/**
 * Generic table report used by the admin "Export -> PDF" action. Any table of
 * records (attendance, bookings, events, register ...) can be turned into a
 * printable PDF with the same columns the screen shows.
 */
export function TableReportDocument({
  title,
  subtitle,
  columns,
  rows,
}: {
  title: string
  subtitle?: string
  columns: string[]
  rows: string[][]
}) {
  const width = `${Math.floor(100 / Math.max(columns.length, 1))}%`

  return (
    <Document>
      <Page
        size="A4"
        orientation={columns.length > 4 ? 'landscape' : 'portrait'}
        style={styles.page}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.headerRow} fixed>
          {columns.map((column, i) => (
            <Text key={i} style={[styles.cell, { width }]}>
              {column}
            </Text>
          ))}
        </View>

        {rows.map((row, ri) => (
          <View key={ri} style={styles.row} wrap={false}>
            {row.map((value, ci) => (
              <Text key={ci} style={[styles.cell, { width }]}>
                {value}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}
