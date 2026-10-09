'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search } from 'lucide-react'

export type VisitorRow = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  first_visit_date: string | null
  status: string | null
}

export function VisitorsTable({ visitors }: { visitors: VisitorRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return visitors
    return visitors.filter(
      (v) =>
        v.full_name.toLowerCase().includes(needle) ||
        (v.phone ?? '').toLowerCase().includes(needle) ||
        (v.email ?? '').toLowerCase().includes(needle) ||
        (v.status ?? '').toLowerCase().includes(needle)
    )
  }, [visitors, query])

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, email, or status..."
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>First visit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                >
                  No visitors found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.full_name}</TableCell>
                  <TableCell>{v.phone ?? '-'}</TableCell>
                  <TableCell>{v.first_visit_date ?? '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        v.status === 'converted'
                          ? 'default'
                          : v.status === 'cold'
                            ? 'outline'
                            : 'secondary'
                      }
                    >
                      {(v.status ?? 'new').replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/admin/visitors/${v.id}`} />}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
