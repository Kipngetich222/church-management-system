import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  small: { fontSize: 9, color: '#666', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    fontWeight: 'bold',
  },
  col1: { width: '30%' },
  col2: { width: '25%' },
  col3: { width: '20%' },
  col4: { width: '25%' },
})

export function MembersReportDocument({
  church,
  members,
}: {
  church: { name: string }
  members: Array<{
    full_name: string | null
    email: string
    phone: string | null
    role: string
    badges: string[]
    is_baptized: boolean
    joined_at: string
  }>
}) {
  const generated = new Date().toLocaleString()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{church.name} — Member Directory</Text>
        <Text style={styles.small}>
          {members.length} member{members.length !== 1 ? 's' : ''} · Generated {generated}
        </Text>

        <View style={styles.headerRow}>
          <Text style={styles.col1}>Name</Text>
          <Text style={styles.col2}>Email</Text>
          <Text style={styles.col3}>Role</Text>
          <Text style={styles.col4}>Badges / Baptized</Text>
        </View>

        {members.map((m, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.col1}>{m.full_name ?? '—'}</Text>
            <Text style={styles.col2}>{m.email}</Text>
            <Text style={[styles.col3, { textTransform: 'capitalize' }]}>
              {m.role.replace('_', ' ')}
            </Text>
            <Text style={styles.col4}>
              {m.badges.join(', ') || '—'}
              {m.is_baptized ? ' · Baptized' : ''}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}