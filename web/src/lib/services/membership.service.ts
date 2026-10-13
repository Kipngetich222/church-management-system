import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/services/email.service'

/**
 * Single-church membership withdrawal.
 *
 * A member can leave one church without deleting their whole account, then
 * browse and join another. When the departing member is the church's only super
 * admin the database hands ownership to another leader (or deletes the church if
 * nobody is left) as part of the same atomic transaction - see
 * `public.withdraw_membership` in migration 0020.
 *
 * Everything that still has a church to point at is written to that church's
 * `audit_logs`; the permanent `deletion_events` tracker records both outcomes
 * (including the church actually being removed).
 */

type Admin = SupabaseClient<Database>

export type WithdrawalResult = {
  status: 'left' | 'church_deleted' | 'not_a_member'
  church_id: string
  church_name: string | null
  role?: string
  members_remaining?: number
  members_removed?: number
  promoted_membership_id?: string | null
  promoted_user_id?: string | null
  promoted_name?: string | null
}

type NestedUser = {
  users?: { email?: string | null; full_name?: string | null } | null
}

async function writeAudit(
  admin: Admin,
  params: {
    churchId: string
    actorId?: string | null
    action: string
    entityType: string
    entityId?: string | null
    metadata?: Record<string, Json>
  }
) {
  await admin.from('audit_logs').insert({
    church_id: params.churchId,
    actor_id: params.actorId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: (params.metadata ?? {}) as Json,
  })
}

async function writeEvent(
  admin: Admin,
  params: {
    action: string
    churchId?: string | null
    churchName?: string | null
    subjectUserId?: string | null
    subjectName?: string | null
    subjectEmail?: string | null
    actorId?: string | null
    metadata?: Record<string, Json>
  }
) {
  await admin.from('deletion_events').insert({
    kind: 'membership',
    action: params.action,
    church_id: params.churchId ?? null,
    church_name: params.churchName ?? null,
    subject_user_id: params.subjectUserId ?? null,
    subject_name: params.subjectName ?? null,
    subject_email: params.subjectEmail ?? null,
    actor_id: params.actorId ?? null,
    metadata: (params.metadata ?? {}) as Json,
  })
}

async function superAdminEmails(
  admin: Admin,
  churchId: string
): Promise<string[]> {
  const { data } = await admin
    .from('church_memberships')
    .select('users(email)')
    .eq('church_id', churchId)
    .eq('role', 'super_admin')

  return ((data ?? []) as unknown as NestedUser[])
    .map((row) => row.users?.email ?? null)
    .filter((email): email is string => Boolean(email))
}

async function emailSafely(params: {
  to: string[]
  subject: string
  html: string
}) {
  if (!params.to.length) return
  try {
    await sendEmail(params)
  } catch (error) {
    console.error('Failed to send membership email:', error)
  }
}

export async function withdrawMembership(params: {
  userId: string
  churchId: string
  actorId?: string | null
}): Promise<WithdrawalResult> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('email, full_name')
    .eq('id', params.userId)
    .maybeSingle()

  const { data, error } = await admin.rpc('withdraw_membership', {
    p_user_id: params.userId,
    p_church_id: params.churchId,
  })

  if (error) {
    throw new Error(error.message)
  }

  const result = data as unknown as WithdrawalResult
  const actorId = params.actorId ?? params.userId

  if (result.status === 'not_a_member') {
    return result
  }

  if (result.status === 'church_deleted') {
    await writeEvent(admin, {
      action: 'church_deleted',
      churchId: result.church_id,
      churchName: result.church_name,
      subjectUserId: params.userId,
      subjectName: profile?.full_name ?? null,
      subjectEmail: profile?.email ?? null,
      actorId,
      metadata: {
        reason: 'last_member_withdrew',
        members_removed: result.members_removed ?? null,
      },
    })
    return result
  }

  // The church still exists, so we can log against it and notify its admins.
  await writeAudit(admin, {
    churchId: result.church_id,
    actorId,
    action: 'membership.withdrawn',
    entityType: 'member',
    entityId: params.userId,
    metadata: {
      member_name: profile?.full_name ?? null,
      member_email: profile?.email ?? null,
      role: result.role ?? 'member',
      members_remaining: result.members_remaining ?? null,
    },
  })

  if (result.promoted_user_id) {
    await writeAudit(admin, {
      churchId: result.church_id,
      actorId,
      action: 'membership.super_admin_transferred',
      entityType: 'member',
      entityId: result.promoted_user_id,
      metadata: {
        reason: 'last_super_admin_departed',
        previous_super_admin: params.userId,
      },
    })
  }

  await writeEvent(admin, {
    action: result.promoted_user_id
      ? 'withdrawn_super_admin_transferred'
      : 'withdrawn',
    churchId: result.church_id,
    churchName: result.church_name,
    subjectUserId: params.userId,
    subjectName: profile?.full_name ?? null,
    subjectEmail: profile?.email ?? null,
    actorId,
    metadata: {
      role: result.role ?? 'member',
      promoted_user_id: result.promoted_user_id ?? null,
      members_remaining: result.members_remaining ?? null,
    },
  })

  const churchLabel = result.church_name ?? 'your church'

  if (result.promoted_user_id && result.promoted_user_id !== params.userId) {
    const { data: promoted } = await admin
      .from('users')
      .select('email, full_name')
      .eq('id', result.promoted_user_id)
      .maybeSingle()

    if (promoted?.email) {
      await emailSafely({
        to: [promoted.email],
        subject: `You are now the super admin of ${churchLabel}`,
        html: `<p>Hi ${promoted.full_name ?? 'there'},</p><p>The previous super admin left <strong>${churchLabel}</strong>, so you have been made its super admin.</p>`,
      })
    }
  }

  const emails = (await superAdminEmails(admin, result.church_id)).filter(
    (email) => email !== profile?.email
  )
  await emailSafely({
    to: emails,
    subject: `A member withdrew from ${churchLabel}`,
    html: `<p><strong>${profile?.full_name ?? 'A member'}</strong> has withdrawn from <strong>${churchLabel}</strong>.</p>`,
  })

  return result
}

/** Withdraw several memberships (used when a departing account must be cleaned up). */
export async function withdrawMemberships(params: {
  userId: string
  churchIds: string[]
  actorId?: string | null
}): Promise<WithdrawalResult[]> {
  const results: WithdrawalResult[] = []
  for (const churchId of params.churchIds) {
    try {
      results.push(
        await withdrawMembership({
          userId: params.userId,
          churchId,
          actorId: params.actorId,
        })
      )
    } catch (error) {
      console.error('Failed to withdraw membership:', error)
    }
  }
  return results
}
