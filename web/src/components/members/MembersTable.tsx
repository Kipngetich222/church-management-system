'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Download } from 'lucide-react'
import { BadgeChip } from './BadgeChip'

type Member = {
  id: string
  role: string
  badges: string[]
  is_baptized: boolean
  users: {
    email: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export function MembersTable({
  members,
  churchId,
}: {
  members: Member[]
  churchId: string
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    if (!q) return members
    const needle = q.toLowerCase()
    return members.filter(
      (m) =>
        (m.users?.full_name ?? '').toLowerCase().includes(needle) ||
        (m.users?.email ?? '').toLowerCase().includes(needle) ||
        m.badges.some((b) => b.includes(needle))
    )
  }, [members, q])

  function exportCSV() {
    const rows = [
      ['Name', 'Email', 'Role', 'Badges', 'Baptized'],
      ...filtered.map((m) => [
        m.users?.full_name ?? '',
        m.users?.email ?? '',
        m.role,
        m.badges.join('|'),
        m.is_baptized ? 'yes' : 'no',
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `members-${churchId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or badge..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export
        </Button>
      </div>

      <div className="border rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Badges</TableHead>
              <TableHead>Baptized</TableHead>
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
                  No members found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => {
                const initials = (m.users?.full_name || m.users?.email || '??')
                  .slice(0, 2)
                  .toUpperCase()
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={m.users?.avatar_url ?? undefined} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {m.users?.full_name || 'Unnamed'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m.users?.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          m.role === 'super_admin' ? 'default' : 'secondary'
                        }
                      >
                        {m.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.badges.slice(0, 3).map((b) => (
                          <BadgeChip key={b} badge={b} />
                        ))}
                        {m.badges.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{m.badges.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.is_baptized ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/admin/members/${m.id}`} />}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
