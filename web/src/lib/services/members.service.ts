import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/auth/redirect'
import {
  isValidPhone,
  normalizePhone,
  PHONE_VALIDATION_MESSAGE,
} from '@/lib/phone'

export type MemberRow = {
  id: string
  user_id: string
  role: 'super_admin' | 'dept_admin' | 'member'
  badges: string[]
  is_baptized: boolean
  status: string
  joined_at: string
  date_of_birth: string | null
  gender: string | null
  phone: string | null
  address: string | null
  users: {
    id: string
    email: string
    full_name: string | null
    phone: string | null
    avatar_url: string | null
  } | null
  department_members?: { department_id: string }[]
}

export async function listMembers(churchId: string): Promise<MemberRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('church_memberships')
    .select(
      `
      id, user_id, role, badges, is_baptized, status, joined_at,
      date_of_birth, gender, phone, address,
      users!inner(id, email, full_name, phone, avatar_url)
    `
    )
    .eq('church_id', churchId)
    .order('joined_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as MemberRow[]
}

type BadgeType = Database['public']['Enums']['badge_type']
type UserUpdate = Database['public']['Tables']['users']['Update']
type MembershipUpdate =
  Database['public']['Tables']['church_memberships']['Update']

export type MemberProfileInput = {
  full_name?: string
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

/**
 * Update a member's profile.
 *
 * Both the member (editing their own profile) and a church admin (editing a
 * member on the admin side) write through this function. It runs on the
 * service-role client because:
 *   - users only exposes a self-update RLS policy, so an admin could never
 *     edit another member's name/phone directly; and
 *   - church_memberships has no UPDATE policy at all, so a member's own edits
 *     to their address/date of birth were silently rejected by RLS.
 *
 * Authorization is enforced here instead: the caller must either own the
 * membership or be an admin of the membership's church. Privileged fields
 * (badges, is_baptized) and the role column are never editable by the member
 * themselves.
 */
export async function updateMemberProfile(params: {
  actorId: string
  membershipId: string
  input: MemberProfileInput
}): Promise<UpdateMemberProfileResult> {
  const admin = createAdminClient()

  const { data: membership, error: lookupError } = await admin
    .from('church_memberships')
    .select('id, user_id, church_id')
    .eq('id', params.membershipId)
    .maybeSingle()

  if (lookupError) throw new Error(lookupError.message)
  if (!membership) return { status: 'not_found' }

  const isSelf = membership.user_id === params.actorId
  let actorRole: string | null = null

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

  // Person-level fields live on the shared users row: a person is the same
  // person across every church, and the membership copies are kept in sync by
  // a database trigger.
  const userUpdate: UserUpdate = {}
  if (input.full_name !== undefined) userUpdate.full_name = input.full_name
  if (input.phone !== undefined) {
    const phone = (input.phone ?? '').trim()
    if (!phone) throw new Error('A phone number is required.')
    if (!isValidPhone(phone)) throw new Error(PHONE_VALIDATION_MESSAGE)
    userUpdate.phone = normalizePhone(phone)
  }
  if (input.date_of_birth !== undefined)
    userUpdate.date_of_birth = input.date_of_birth || null
  if (input.gender !== undefined) userUpdate.gender = input.gender || null
  if (input.category !== undefined)
    userUpdate.category = (input.category || null) as UserUpdate['category']

  if (Object.keys(userUpdate).length) {
    const { error } = await admin
      .from('users')
      .update(userUpdate)
      .eq('id', membership.user_id)
    if (error) throw new Error(error.message)
  }

  // Membership-scoped fields. Badges are assigned by a church's super admin,
  // and only super admins may change the baptized flag (mirrors the UI).
  const membershipUpdate: MembershipUpdate = {}
  if (input.address !== undefined)
    membershipUpdate.address = input.address || null
  if (actorRole === 'super_admin' && input.badges !== undefined)
    membershipUpdate.badges = input.badges as BadgeType[]
  if (actorRole === 'super_admin' && input.is_baptized !== undefined)
    membershipUpdate.is_baptized = input.is_baptized

  if (Object.keys(membershipUpdate).length) {
    const { error } = await admin
      .from('church_memberships')
      .update(membershipUpdate)
      .eq('id', membership.id)
    if (error) throw new Error(error.message)
  }

  await admin.from('audit_logs').insert({
    church_id: membership.church_id,
    actor_id: params.actorId,
    action: isSelf ? 'member.self_update' : 'member.update',
    entity_type: 'church_membership',
    entity_id: membership.id,
    metadata: {
      fields: Object.keys({ ...userUpdate, ...membershipUpdate }),
    },
  })

  return { status: 'ok' }
}
