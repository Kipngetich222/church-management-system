'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Smartphone, UserRound } from 'lucide-react'
import { BadgeChip, findBadgeDefinition } from './BadgeChip'
import { DeleteMemberButton } from './DeleteMemberButton'
import { MEMBER_CATEGORY_LABELS } from '@/lib/constants/members'
import {
  effectiveMemberCategory,
  memberAvatar,
  memberEmail,
  memberName,
  memberPhone,
  type MemberBadgeDefinition,
  type MemberRecord,
} from '@/lib/types/members'

export function MembersTable({
  members,
  badges,
  isSuperAdmin,
}: {
  members: MemberRecord[]
  badges: MemberBadgeDefinition[]
  isSuperAdmin: boolean
}) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')

  const badgeMap = useMemo(
    () =>
      new Map(badges.map((badge) => [badge.name.trim().toLowerCase(), badge])),
    [badges]
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return members.filter((member) => {
      if (category !== 'all' && effectiveMemberCategory(member) !== category) {
        return false
      }
      if (!needle) return true

      return (
        memberName(member).toLowerCase().includes(needle) ||
        memberEmail(member).toLowerCase().includes(needle) ||
        memberPhone(member).toLowerCase().includes(needle) ||
        member.badges.some((badge) => badge.toLowerCase().includes(needle)) ||
        (MEMBER_CATEGORY_LABELS[effectiveMemberCategory(member) ?? ''] ?? '')
          .toLowerCase()
          .includes(needle)
      )
    })
  }, [category, members, q])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, or badge..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value ?? 'all')}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="men">Men</SelectItem>
            <SelectItem value="women">Women</SelectItem>
            <SelectItem value="youth">Youth</SelectItem>
            <SelectItem value="children">Children</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          Showing {filtered.length} of {members.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Badges</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Baptized</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  No members found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((member) => {
                const name = memberName(member)
                const initials = name.slice(0, 2).toUpperCase()
                const email = memberEmail(member)
                const phone = memberPhone(member)
                const categoryValue = effectiveMemberCategory(member)

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={memberAvatar(member) ?? undefined}
                          />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{name}</span>
                          <span className="text-xs text-muted-foreground">
                            {phone || email || 'No contact details'}
                          </span>
                          {phone && email ? (
                            <span className="text-[11px] text-muted-foreground">
                              {email}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {MEMBER_CATEGORY_LABELS[categoryValue ?? ''] ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.badges.slice(0, 3).map((badge) => (
                          <BadgeChip
                            key={badge}
                            badge={badge}
                            definition={
                              badgeMap.get(badge.trim().toLowerCase()) ??
                              findBadgeDefinition(badge, badges)
                            }
                          />
                        ))}
                        {member.badges.length > 3 ? (
                          <span className="self-center text-xs text-muted-foreground">
                            +{member.badges.length - 3}
                          </span>
                        ) : null}
                        {!member.badges.length ? (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.user_id ? (
                        <Badge variant="outline" className="gap-1">
                          <UserRound className="h-3 w-3" /> Account
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        >
                          <Smartphone className="h-3 w-3" /> Manual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.is_baptized ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/admin/members/${member.id}`} />}
                        >
                          Edit
                        </Button>
                        {isSuperAdmin ? (
                          <DeleteMemberButton
                            memberId={member.id}
                            memberName={name}
                          />
                        ) : null}
                      </div>
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
