import { createAdminClient } from '@/lib/supabase/admin'

export const PRAYER_RETENTION_DAYS = 7
export const LEADER_BADGES = ['pastor', 'elder', 'deacon'] as const

type LeaderRow = {
  name?: string | null
  title?: string | null
  email?: string | null
}

type MembershipRow = {
  id: string
  role?: string | null
  badges?: string[] | null
  users?:
    | { full_name?: string | null; email?: string | null }
    | { full_name?: string | null; email?: string | null }[]
    | null
}

export type PrayerTarget = {
  id: string
  name: string
  title: string
  isAdmin: boolean
}

export type PublicPrayerRequest = {
  id: string
  title: string
  body: string
  created_at: string | null
  visibility: string | null
  church_memberships?:
    | {
        users?:
          { full_name?: string | null } | { full_name?: string | null }[] | null
      }
    | {
        users?:
          { full_name?: string | null } | { full_name?: string | null }[] | null
      }[]
    | null
  churches?: { name?: string | null } | { name?: string | null }[] | null
}

export function prayerRetentionCutoff() {
  return new Date(
    Date.now() - PRAYER_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
}

function adminClient() {
  return createAdminClient()
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * People a member can channel a prayer or counselling request to.
 *
 * A target must have a membership account so they can sign in and see the
 * request. We include church admins, members carrying a pastoral/leadership
 * badge, and published church leaders whose email matches an account.
 */
export async function listPrayerTargets(
  churchId: string
): Promise<PrayerTarget[]> {
  const admin = adminClient()

  const [{ data: memberships }, { data: leaders }] = await Promise.all([
    admin
      .from('church_memberships')
      .select(
        'id, role, badges, users!church_memberships_user_id_fkey(full_name, email)'
      )
      .eq('church_id', churchId)
      .eq('status', 'active'),
    admin
      .from('church_leaders')
      .select('name, title, email')
      .eq('church_id', churchId),
  ])

  const leaderByEmail = new Map<string, LeaderRow>(
    ((leaders ?? []) as LeaderRow[])
      .filter((leader) => leader.email)
      .map((leader) => [String(leader.email).trim().toLowerCase(), leader])
  )

  const targets = new Map<string, PrayerTarget>()

  for (const membership of (memberships ?? []) as MembershipRow[]) {
    const user = first(membership.users)
    const email = String(user?.email ?? '')
      .trim()
      .toLowerCase()
    const badges = Array.isArray(membership.badges) ? membership.badges : []
    const isAdmin =
      membership.role === 'super_admin' || membership.role === 'dept_admin'
    const hasLeaderBadge = badges.some((badge: string) =>
      (LEADER_BADGES as readonly string[]).includes(badge)
    )
    const publishedLeader = email ? leaderByEmail.get(email) : null

    if (!isAdmin && !hasLeaderBadge && !publishedLeader) continue

    const fallbackName = String(
      user?.full_name ?? user?.email ?? 'Church leader'
    )
    const title =
      (publishedLeader?.title as string | undefined) ??
      (membership.role === 'super_admin'
        ? 'Church admin'
        : membership.role === 'dept_admin'
          ? 'Department leader'
          : 'Church leader')

    targets.set(membership.id, {
      id: membership.id,
      name: publishedLeader?.name ?? fallbackName,
      title,
      isAdmin,
    })
  }

  return Array.from(targets.values()).sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Public prayer wall entries. Runs with the service-role client because the
 * author's membership/user rows are not readable by signed-out visitors under
 * RLS. Only rows that are explicitly public and still active are selected.
 */
export async function listPublicPrayerRequests(): Promise<
  PublicPrayerRequest[]
> {
  const admin = adminClient()

  const { data } = await admin
    .from('prayer_requests')
    .select(
      `
      id, title, body, created_at, visibility,
      church_memberships!prayer_requests_membership_id_fkey(users!church_memberships_user_id_fkey(full_name)),
      churches(name)
    `
    )
    .eq('type', 'prayer')
    .in('visibility', ['public_anonymous', 'public_named'])
    .is('archived_at', null)
    .in('status', ['open', 'in_progress'])
    .gte('created_at', prayerRetentionCutoff())
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []) as unknown as PublicPrayerRequest[]
}
