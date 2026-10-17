import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { isAdminRole } from '@/lib/auth/redirect'
import {
  isValidPhone,
  normalizePhone,
  PHONE_VALIDATION_MESSAGE,
} from '@/lib/phone'
import { DEFAULT_MEMBER_BADGES } from '@/lib/constants/members'
import type { MemberBadgeDefinition, MemberRecord } from '@/lib/types/members'
export { effectiveMemberCategory, getMemberStats } from '@/lib/types/members'
export type { MemberStats } from '@/lib/types/members'

export type MemberRow = MemberRecord

/**
 * The generated Supabase types are refreshed from the live schema. The member
 * upgrades add columns/tables before that regeneration runs, so use a narrow
 * untyped shim for these privileged service-role reads and writes.
 */
function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export type MemberProfileInput = {
  full_name?: string
  email?: string | null
  phone?: string | null
  date_of_birth?: string | null
  gender?: string | null
  category?: string | null
  address?: string | null
  badges?: string[]
  is_baptized?: boolean
}

export type UpdateMemberProfileResult =
  { status: 'ok' } | { status: 'not_found' } | { status: 'forbidden' }

export type DeleteMemberResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'self' }

type MembershipQueryRow = Record<string, unknown> & {
  badges?: unknown
  users?: unknown
}

const MEMBER_SELECT = `
  id, user_id, role, badges, is_baptized, status, joined_at,
  date_of_birth, gender, phone, address, full_name, email, category,
  avatar_url, is_manual,
  users!church_memberships_user_id_fkey(id, email, full_name, phone, avatar_url, date_of_birth, gender, category)
`

/**
 * Pre-upgrade memberships only had person details on the joined user row.
 * Keep this query available so the admin screen still renders while a
 * deployment is waiting for 0032_member_management_and_badges.sql.
 */
const LEGACY_MEMBER_SELECT = `
  id, user_id, role, badges, is_baptized, status, joined_at,
  date_of_birth, gender, address,
  users!church_memberships_user_id_fkey(id, email, full_name, phone, avatar_url, date_of_birth, gender, category)
`

function isMissingMemberColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as { code?: string; message?: string }
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    Boolean(message && /column .* does not exist/i.test(message))
  )
}

function normaliseUser(value: unknown): MemberRecord['users'] {
  const user = Array.isArray(value) ? value[0] : value
  if (!user || typeof user !== 'object') return null
  return user as MemberRecord['users']
}

function normaliseMember(row: MembershipQueryRow): MemberRecord {
  const user = normaliseUser(row.users)
  return {
    id: String(row.id),
    user_id: (row.user_id as string | null) ?? null,
    role: String(row.role ?? 'member'),
    badges: Array.isArray(row.badges) ? (row.badges as string[]) : [],
    is_baptized: Boolean(row.is_baptized),
    status: (row.status as string | null) ?? 'active',
    joined_at: (row.joined_at as string | null) ?? new Date().toISOString(),
    date_of_birth:
      (row.date_of_birth as string | null) ?? user?.date_of_birth ?? null,
    gender: (row.gender as string | null) ?? user?.gender ?? null,
    phone: (row.phone as string | null) ?? user?.phone ?? null,
    address: (row.address as string | null) ?? null,
    full_name: (row.full_name as string | null) ?? user?.full_name ?? null,
    email: (row.email as string | null) ?? user?.email ?? null,
    category: (row.category as string | null) ?? user?.category ?? null,
    avatar_url: (row.avatar_url as string | null) ?? user?.avatar_url ?? null,
    is_manual: Boolean(row.is_manual ?? !row.user_id),
    users: user,
  }
}

export async function listMembers(churchId: string): Promise<MemberRecord[]> {
  // Service-role read: callers gate this behind requirePermission(). RLS would
  // otherwise hide co-member user profiles and leave the directory nameless.
  const supabase = adminClient()
  const run = (columns: string) =>
    supabase
      .from('church_memberships')
      .select(columns)
      .eq('church_id', churchId)
      .order('joined_at', { ascending: false })

  let { data, error } = await run(MEMBER_SELECT)

  if (error && isMissingMemberColumn(error)) {
    console.warn(
      'Member upgrade migration is not applied yet; falling back to the legacy member query.'
    )
    ;({ data, error } = await run(LEGACY_MEMBER_SELECT))
  }

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as MembershipQueryRow[]).map(normaliseMember)
}

export async function getMember(
  churchId: string,
  membershipId: string
): Promise<MemberRecord | null> {
  const supabase = adminClient()
  const run = (columns: string) =>
    supabase
      .from('church_memberships')
      .select(columns)
      .eq('church_id', churchId)
      .eq('id', membershipId)
      .maybeSingle()

  let { data, error } = await run(MEMBER_SELECT)

  if (error && isMissingMemberColumn(error)) {
    ;({ data, error } = await run(LEGACY_MEMBER_SELECT))
  }

  if (error) throw new Error(error.message)
  if (!data) return null
  return normaliseMember(data as unknown as MembershipQueryRow)
}

export async function listMemberBadges(
  churchId: string,
  members: MemberRecord[] = []
): Promise<MemberBadgeDefinition[]> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('member_badges')
    .select('id, church_id, name, description, color, icon, sort_order')
    .eq('church_id', churchId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  const counts = new Map<string, number>()
  for (const member of members) {
    for (const badge of member.badges) {
      const key = badge.trim().toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  if (error) {
    return DEFAULT_MEMBER_BADGES.map((badge) => ({
      ...badge,
      description: badge.description,
      assignedCount: counts.get(badge.name) ?? 0,
    }))
  }

  return ((data ?? []) as unknown as MemberBadgeDefinition[]).map((badge) => ({
    ...badge,
    description: badge.description ?? null,
    color: badge.color || '#6366f1',
    icon: badge.icon || 'award',
    assignedCount: counts.get(badge.name.trim().toLowerCase()) ?? 0,
  }))
}

export async function createMemberBadge(params: {
  churchId: string
  actorId: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
}): Promise<MemberBadgeDefinition> {
  const name = params.name.trim()
  if (!name) throw new Error('Badge name is required.')
  if (name.length > 60) throw new Error('Badge name is too long.')

  const color = /^#[0-9a-f]{6}$/i.test(params.color ?? '')
    ? String(params.color)
    : '#6366f1'

  const admin = adminClient()
  const { data, error } = await admin
    .from('member_badges')
    .insert({
      church_id: params.churchId,
      name,
      description: params.description?.trim() || null,
      color,
      icon: params.icon || 'award',
      created_by: params.actorId,
    })
    .select('id, church_id, name, description, color, icon, sort_order')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A badge with that name already exists.')
    }
    throw new Error(error.message)
  }

  await admin.from('audit_logs').insert({
    church_id: params.churchId,
    actor_id: params.actorId,
    action: 'member_badge.create',
    entity_type: 'member_badge',
    entity_id: data.id,
    metadata: { name },
  })

  return data as MemberBadgeDefinition
}

export async function updateMemberBadge(params: {
  churchId: string
  actorId: string
  badgeId: string
  name?: string
  description?: string | null
  color?: string | null
  icon?: string | null
}): Promise<MemberBadgeDefinition> {
  const admin = adminClient()
  const badgeTable = admin.from('member_badges')

  const { data: current, error: readError } = await badgeTable
    .select('id, church_id, name, description, color, icon')
    .eq('church_id', params.churchId)
    .eq('id', params.badgeId)
    .maybeSingle()

  if (readError) throw new Error(readError.message)
  if (!current) throw new Error('Badge not found.')

  const update: Record<string, unknown> = {}
  if (params.name !== undefined) {
    const name = params.name.trim()
    if (!name) throw new Error('Badge name is required.')
    if (name.length > 60) throw new Error('Badge name is too long.')
    update.name = name
  }
  if (params.description !== undefined)
    update.description = params.description?.trim() || null
  if (params.color !== undefined) {
    update.color = /^#[0-9a-f]{6}$/i.test(params.color ?? '')
      ? params.color
      : current.color
  }
  if (params.icon !== undefined) update.icon = params.icon || current.icon

  if (!Object.keys(update).length) return current as MemberBadgeDefinition

  const { data, error } = await badgeTable
    .update(update)
    .eq('church_id', params.churchId)
    .eq('id', params.badgeId)
    .select('id, church_id, name, description, color, icon, sort_order')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A badge with that name already exists.')
    }
    throw new Error(error.message)
  }

  // Keep already-assigned member badges in step with a rename.
  if (update.name && update.name !== current.name) {
    const membershipTable = admin.from('church_memberships')
    const { data: assigned } = await membershipTable
      .select('id, badges')
      .eq('church_id', params.churchId)
      .contains('badges', [current.name])

    for (const row of assigned ?? []) {
      const badges = (row.badges ?? []).map((badge: string) =>
        badge === current.name ? update.name : badge
      )
      await membershipTable.update({ badges }).eq('id', row.id)
    }
  }

  await admin.from('audit_logs').insert({
    church_id: params.churchId,
    actor_id: params.actorId,
    action: 'member_badge.update',
    entity_type: 'member_badge',
    entity_id: params.badgeId,
    metadata: { fields: Object.keys(update) },
  })

  return data as MemberBadgeDefinition
}

export async function deleteMemberBadge(params: {
  churchId: string
  actorId: string
  badgeId: string
}): Promise<void> {
  const admin = adminClient()
  const badgeTable = admin.from('member_badges')

  const { data: current, error } = await badgeTable
    .select('id, name')
    .eq('church_id', params.churchId)
    .eq('id', params.badgeId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!current) throw new Error('Badge not found.')

  const membershipTable = admin.from('church_memberships')
  const { data: assigned } = await membershipTable
    .select('id, badges')
    .eq('church_id', params.churchId)
    .contains('badges', [current.name])

  for (const row of assigned ?? []) {
    const badges = (row.badges ?? []).filter(
      (badge: string) => badge !== current.name
    )
    await membershipTable.update({ badges }).eq('id', row.id)
  }

  const { error: deleteError } = await badgeTable
    .delete()
    .eq('church_id', params.churchId)
    .eq('id', params.badgeId)

  if (deleteError) throw new Error(deleteError.message)

  await admin.from('audit_logs').insert({
    church_id: params.churchId,
    actor_id: params.actorId,
    action: 'member_badge.delete',
    entity_type: 'member_badge',
    entity_id: params.badgeId,
    metadata: { name: current.name },
  })
}

/**
 * Update a member's profile.
 *
 * Account members keep person-level fields on the shared users row; manual
 * members (no account) keep them on the membership row. Authorization is
 * enforced here because the service-role client bypasses RLS.
 */
export async function updateMemberProfile(params: {
  actorId: string
  membershipId: string
  input: MemberProfileInput
}): Promise<UpdateMemberProfileResult> {
  const admin = adminClient()

  let { data: membership, error: lookupError } = await admin
    .from('church_memberships')
    .select(
      'id, user_id, church_id, role, badges, full_name, email, phone, category'
    )
    .eq('id', params.membershipId)
    .maybeSingle()

  let legacySchema = false
  if (lookupError && isMissingMemberColumn(lookupError)) {
    legacySchema = true
    ;({ data: membership, error: lookupError } = await admin
      .from('church_memberships')
      .select('id, user_id, church_id, role, badges')
      .eq('id', params.membershipId)
      .maybeSingle())
  }

  if (lookupError) throw new Error(lookupError.message)
  if (!membership) return { status: 'not_found' }

  const isSelf = Boolean(
    membership.user_id && membership.user_id === params.actorId
  )
  // Self-edits still need the caller's role: an admin editing their own
  // membership must be able to change badges (and baptism, for super admins).
  // Regular members fall through with role "member" and stay restricted.
  let actorRole: string | null = isSelf
    ? String(membership.role ?? 'member')
    : null

  if (!isSelf) {
    const { data: actor } = await admin
      .from('church_memberships')
      .select('role')
      .eq('user_id', params.actorId)
      .eq('church_id', membership.church_id)
      .maybeSingle()

    if (!actor || !isAdminRole(actor.role)) return { status: 'forbidden' }
    actorRole = actor.role
  }

  const { input } = params
  const isManual = !membership.user_id

  if (input.full_name !== undefined) {
    const name = input.full_name.trim()
    if (!name) throw new Error('A name is required.')
    if (name.length > 160) throw new Error('Name is too long.')
  }

  if (input.phone !== undefined && input.phone) {
    if (!isValidPhone(input.phone)) throw new Error(PHONE_VALIDATION_MESSAGE)
  }

  if (isManual) {
    const category = input.category ?? membership.category
    const phone = input.phone !== undefined ? input.phone : membership.phone
    if (category !== 'children' && !phone?.trim()) {
      throw new Error(
        'A phone number is required for adults and youth without an account so the church can reach them by SMS.'
      )
    }
  }

  const userUpdate: Record<string, unknown> = {}
  const membershipUpdate: Record<string, unknown> = {}

  if (!isManual) {
    if (input.full_name !== undefined)
      userUpdate.full_name = input.full_name.trim()
    if (input.phone !== undefined) {
      const phone = (input.phone ?? '').trim()
      if (!phone) throw new Error('A phone number is required.')
      userUpdate.phone = normalizePhone(phone)
    }
    if (input.date_of_birth !== undefined)
      userUpdate.date_of_birth = input.date_of_birth || null
    if (input.gender !== undefined) userUpdate.gender = input.gender || null
    if (input.category !== undefined)
      userUpdate.category = input.category || null

    if (Object.keys(userUpdate).length) {
      const { error } = await admin
        .from('users')
        .update(userUpdate as never)
        .eq('id', membership.user_id!)
      if (error) throw new Error(error.message)
    }

    // Keep the denormalised admin-view columns in step immediately. They do
    // not exist until the member upgrade migration has been applied.
    if (!legacySchema) {
      if (input.full_name !== undefined)
        membershipUpdate.full_name = input.full_name.trim()
      if (input.phone !== undefined)
        membershipUpdate.phone = input.phone
          ? normalizePhone(input.phone)
          : null
      if (input.category !== undefined)
        membershipUpdate.category = input.category || null
    }
  } else {
    if (input.full_name !== undefined)
      membershipUpdate.full_name = input.full_name.trim()
    if (input.email !== undefined)
      membershipUpdate.email = input.email?.trim() || null
    if (input.phone !== undefined)
      membershipUpdate.phone = input.phone ? normalizePhone(input.phone) : null
    if (input.date_of_birth !== undefined)
      membershipUpdate.date_of_birth = input.date_of_birth || null
    if (input.gender !== undefined)
      membershipUpdate.gender = input.gender || null
    if (input.category !== undefined)
      membershipUpdate.category = input.category || null
  }

  if (input.address !== undefined)
    membershipUpdate.address = input.address || null

  // Church admins may assign badges; only super admins may set baptism.
  if (actorRole && isAdminRole(actorRole) && input.badges !== undefined) {
    const uniqueBadges = new Map<string, string>()
    for (const badge of input.badges) {
      const name = badge.trim()
      if (name) uniqueBadges.set(name.toLowerCase(), name)
    }
    membershipUpdate.badges = Array.from(uniqueBadges.values()).slice(0, 20)
  }
  if (actorRole === 'super_admin' && input.is_baptized !== undefined)
    membershipUpdate.is_baptized = input.is_baptized

  if (Object.keys(membershipUpdate).length) {
    const { error } = await admin
      .from('church_memberships')
      .update(membershipUpdate as never)
      .eq('id', membership.id)
    if (error) throw new Error(error.message)
  }

  await admin.from('audit_logs').insert({
    church_id: membership.church_id,
    actor_id: params.actorId,
    action: isSelf
      ? 'member.self_update'
      : isManual
        ? 'member.manual_update'
        : 'member.update',
    entity_type: 'church_membership',
    entity_id: membership.id,
    metadata: {
      fields: Object.keys({ ...userUpdate, ...membershipUpdate }),
    },
  })

  return { status: 'ok' }
}

/**
 * Remove a member from a church. Only a super admin may do this. The auth
 * account itself is left intact (the person may belong to other churches);
 * only this church's membership and its member data are deleted.
 */
export async function deleteMember(params: {
  actorId: string
  churchId: string
  membershipId: string
}): Promise<DeleteMemberResult> {
  const admin = adminClient()

  const { data: actor } = await admin
    .from('church_memberships')
    .select('id, role')
    .eq('user_id', params.actorId)
    .eq('church_id', params.churchId)
    .maybeSingle()

  if (!actor || actor.role !== 'super_admin') return { status: 'forbidden' }

  let { data: membership, error } = await admin
    .from('church_memberships')
    .select('id, user_id, full_name, email, phone, badges')
    .eq('id', params.membershipId)
    .eq('church_id', params.churchId)
    .maybeSingle()

  if (error && isMissingMemberColumn(error)) {
    ;({ data: membership, error } = await admin
      .from('church_memberships')
      .select('id, user_id, badges')
      .eq('id', params.membershipId)
      .eq('church_id', params.churchId)
      .maybeSingle())
  }

  if (error) throw new Error(error.message)
  if (!membership) return { status: 'not_found' }
  if (membership.id === actor.id) return { status: 'self' }

  const { error: deleteError } = await admin
    .from('church_memberships')
    .delete()
    .eq('id', params.membershipId)
    .eq('church_id', params.churchId)

  if (deleteError) throw new Error(deleteError.message)

  await admin.from('audit_logs').insert({
    church_id: params.churchId,
    actor_id: params.actorId,
    action: 'member.delete',
    entity_type: 'church_membership',
    entity_id: params.membershipId,
    metadata: {
      name: membership.full_name,
      email: membership.email,
      phone: membership.phone,
      badges: membership.badges ?? [],
    },
  })

  return { status: 'ok' }
}
