'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { OfferingRow } from '@/lib/services/finance.service'

export function OfferingsTable({ offerings }: { offerings: OfferingRow[] }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')

  const filtered = offerings.filter((o) => {
    if (type !== 'all' && o.type !== type) return false
    if (!q) return true
    const needle = q.toLowerCase()
    return (
      o.church_memberships?.users?.full_name?.toLowerCase().includes(needle) ||
      o.receipt_number?.toLowerCase().includes(needle) ||
      o.reference?.toLowerCase().includes(needle)
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={type} onValueChange={(v) => setType(v ?? 'all')}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="tithe">Tithe</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="missions">Missions</SelectItem>
            <SelectItem value="building_fund">Building Fund</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-sm">{format(new Date(o.given_at), 'MMM d, yyyy')}</TableCell>
                <TableCell>{o.church_memberships?.users?.full_name ?? 'Anonymous'}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{o.type.replace('_', ' ')}</Badge></TableCell>
                <TableCell className="text-sm capitalize">{o.method.replace('_', ' ')}</TableCell>
                <TableCell className="text-xs font-mono">{o.receipt_number ?? '—'}</TableCell>
                <TableCell className="text-right font-medium">
                  {o.currency} {Number(o.amount).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No offerings found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
