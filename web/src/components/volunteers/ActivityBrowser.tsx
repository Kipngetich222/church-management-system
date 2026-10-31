'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ActivityDetails } from './ActivityDetails'
import { SignUpShiftButton } from './SignUpShiftButton'
import { VOLUNTEER_CATEGORIES, type VolunteerActivity } from '@/lib/volunteers'

export function ActivityBrowser({
  activities,
  membershipId,
  admin = false,
  canManage = false,
}: {
  activities: VolunteerActivity[]
  membershipId?: string
  admin?: boolean
  canManage?: boolean
}) {
  const [filter, setFilter] = useState(admin ? 'all' : 'open')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const visible = activities.filter((activity) => {
    const open = activity.is_active && activity.next_starts_at !== null
    const mine =
      activity.my_status === 'confirmed' || activity.my_status === 'waitlist'
    return (
      (filter === 'all' ||
        (filter === 'open' && open) ||
        (filter === 'mine' && mine) ||
        (filter === 'closed' && !open)) &&
      (category === 'all' || activity.category === category) &&
      `${activity.title} ${activity.location ?? ''} ${activity.notes ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Search volunteer activities"
          placeholder="Search activities or venues…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by type of work"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All types of work</option>
          {Object.entries(VOLUNTEER_CATEGORIES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter activities"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="open">Open activities</option>
          {!admin && <option value="mine">My participation</option>}
          <option value="all">All activities</option>
          <option value="closed">Past / closed</option>
        </select>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'activity' : 'activities'}
      </p>
      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {activities.length === 0
              ? admin
                ? 'Create your first activity to invite members to help.'
                : 'No volunteer activities have been posted yet. Check back soon.'
              : filter === 'mine'
                ? 'You have not joined any activities yet. Choose an open activity to participate.'
                : 'No activities match these filters.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((activity) => {
            const closed = !activity.is_active || !activity.next_starts_at
            const signedUp =
              activity.my_status === 'confirmed' ||
              activity.my_status === 'waitlist'
            const full =
              activity.slots !== null &&
              activity.participant_count >= activity.slots
            return (
              <Card
                key={activity.id}
                id={`activity-${activity.id}`}
                className="flex flex-col"
              >
                <CardHeader className="space-y-3">
                  <CardTitle className="text-lg">{activity.title}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {VOLUNTEER_CATEGORIES[
                        activity.category as keyof typeof VOLUNTEER_CATEGORIES
                      ] ?? 'Other service'}
                    </Badge>
                    <Badge variant="outline">
                      {closed
                        ? !activity.is_active
                          ? 'Closed'
                          : 'Finished'
                        : full
                          ? 'Full'
                          : 'Open'}
                    </Badge>
                    {!admin && signedUp && (
                      <Badge>
                        {activity.my_status === 'waitlist'
                          ? 'On waiting list'
                          : 'You are participating'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <ActivityDetails activity={activity} />
                  <p className="text-sm text-muted-foreground">
                    {activity.participant_count} participating
                    {activity.slots === null
                      ? ' · Everyone is welcome'
                      : ` · ${Math.max(0, activity.slots - activity.participant_count)} of ${activity.slots} spaces remaining`}
                  </p>
                  {!admin && activity.recurrence !== 'none' && (
                    <p className="text-xs text-muted-foreground">
                      Join this recurring activity until you cancel.
                    </p>
                  )}
                  <div className="mt-auto">
                    {admin ? (
                      <Button variant="outline" asChild className="w-full">
                        <Link href={`/admin/volunteers/${activity.id}`}>
                          {canManage
                            ? 'Manage activity & participants'
                            : 'View activity & participants'}
                        </Link>
                      </Button>
                    ) : (
                      membershipId && (
                        <SignUpShiftButton
                          shiftId={activity.id}
                          membershipId={membershipId}
                          signedUp={signedUp}
                          signupId={activity.my_signup_id}
                          full={full}
                          closed={closed}
                        />
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
