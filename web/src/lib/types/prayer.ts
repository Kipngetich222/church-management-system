export type PrayerRequestKind = 'prayer' | 'counseling'
export type PrayerAudience = 'church' | 'leaders' | 'person'

export type PrayerUser = {
  full_name?: string | null
  email?: string | null
}

export type PrayerMembership = {
  id?: string
  users?: PrayerUser | PrayerUser[] | null
}

export type PrayerInteractionRow = {
  id: string
  body: string
  created_at: string
  is_internal: boolean | null
  author_membership_id?: string
  church_memberships?: PrayerMembership | PrayerMembership[] | null
}

export type PrayerRequestRow = {
  id: string
  title: string
  body: string
  type: PrayerRequestKind
  status: string
  audience?: PrayerAudience | string | null
  visibility?: string
  created_at: string
  membership_id?: string
  assigned_to?: string | null
  church_id?: string
  archived_at?: string | null
  prayer_interactions?: PrayerInteractionRow[] | null
  church_memberships?: PrayerMembership | PrayerMembership[] | null
  assigned_membership?: PrayerMembership | PrayerMembership[] | null
}

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function prayerAuthorName(request: PrayerRequestRow) {
  const membership = firstRelation(request.church_memberships)
  return firstRelation(membership?.users)?.full_name ?? 'Anonymous'
}
