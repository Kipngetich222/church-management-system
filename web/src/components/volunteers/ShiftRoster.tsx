'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { volunteerError } from '@/lib/volunteers'
import type { VolunteerParticipant } from '@/lib/services/volunteers.service'

export function ShiftRoster({
  signups,
  canManage = false,
  showActivity = false,
}: {
  signups: VolunteerParticipant[]
  canManage?: boolean
  showActivity?: boolean
}) {
  const router = useRouter()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const active = signups.filter((signup) => signup.status !== 'cancelled')
  const rows = active
    .map((signup) => {
      const membership = signup.church_memberships
      return {
        ...signup,
        name: membership?.users?.full_name || membership?.full_name || 'Member',
        email: membership?.users?.email || membership?.email,
        phone: membership?.users?.phone || membership?.phone,
      }
    })
    .filter((signup) =>
      `${signup.name} ${signup.email ?? ''} ${signup.phone ?? ''} ${signup.volunteer_shifts.title}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )

  async function remove(id: string, shiftId: string) {
    setRemovingId(id)
    setError('')
    try {
      const { data, error } = await createClient()
        .from('volunteer_signups')
        .delete()
        .eq('id', id)
        .eq('shift_id', shiftId)
        .select('id')
        .single()
      if (error || !data)
        throw error ?? new Error('Unable to remove this participant.')
      startTransition(() => router.refresh())
    } catch (err) {
      setError(volunteerError(err))
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Card id="participants">
      <CardHeader>
        <CardTitle>
          Participants (
          {
            active.filter((row) => !row.status || row.status === 'confirmed')
              .length
          }{' '}
          confirmed
          {active.some((row) => row.status === 'waitlist')
            ? `, ${active.filter((row) => row.status === 'waitlist').length} waiting`
            : ''}
          )
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          aria-label="Search participants"
          placeholder={
            showActivity
              ? 'Search by name, contact or activity…'
              : 'Search participants…'
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {active.length
              ? 'No participants match your search.'
              : 'No one has chosen to participate yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Participant</th>
                  {showActivity && <th className="p-3">Activity</th>}
                  <th className="p-3">Status</th>
                  {canManage && (
                    <th className="p-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{row.name}</p>
                      {row.email && (
                        <a
                          className="block text-muted-foreground hover:underline"
                          href={`mailto:${row.email}`}
                        >
                          {row.email}
                        </a>
                      )}
                      {row.phone && (
                        <a
                          className="block text-muted-foreground hover:underline"
                          href={`tel:${row.phone}`}
                        >
                          {row.phone}
                        </a>
                      )}
                      {row.signed_up_at && (
                        <p className="text-xs text-muted-foreground">
                          Joined{' '}
                          {new Intl.DateTimeFormat('en-GB', {
                            timeZone: 'Africa/Nairobi',
                            dateStyle: 'medium',
                          }).format(new Date(row.signed_up_at))}
                        </p>
                      )}
                    </td>
                    {showActivity && (
                      <td className="p-3">
                        <Link
                          className="hover:underline"
                          href={`/admin/volunteers/${row.shift_id}`}
                        >
                          {row.volunteer_shifts.title}
                        </Link>
                      </td>
                    )}
                    <td className="p-3">
                      <Badge
                        variant={
                          row.status === 'waitlist' ? 'secondary' : 'default'
                        }
                      >
                        {row.status === 'waitlist'
                          ? 'Waiting'
                          : 'Participating'}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={removingId !== null || pending}
                          onClick={() => remove(row.id, row.shift_id)}
                          aria-label={`Remove ${row.name} from ${row.volunteer_shifts.title}`}
                        >
                          {removingId === row.id ? 'Removing…' : 'Remove'}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
