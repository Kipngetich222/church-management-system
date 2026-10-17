import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/services/email.service'
import { withdrawMembership } from '@/lib/services/membership.service'

/**
 * Two-step, reversible account deletion.
 *
 * Member deletion: the member requests it, then has MEMBER_REVERT_WINDOW_MS to
 * change their mind. A scheduled job permanently deletes the account after the
 * window passes. Deleting the auth user cascades through public.users to
 * church_memberships, so every church they belonged to drops by one member.
 *
 * Church deletion: a super admin starts it and every super admin of the church
 * must accept. Once all accept, the church enters a CHURCH_REVERT_WINDOW_MS
 * grace period before the scheduled job deletes it permanently. Deleting the
 * church cascades to church_memberships, detaching all of its members.
 *
 * Every transition is written to `deletion_events` (a tracker that survives the
 * deletion) and, where the church still exists, to its `audit_logs`.
 */

/** Members get 10 minutes to undo a deletion request. */
export const MEMBER_REVERT_WINDOW_MS = 10 * 60 * 1000
/** Once all super admins approve, they get 24 hours to undo the deletion. */
export const CHURCH_REVERT_WINDOW_MS = 24 * 60 * 60 * 1000

type Admin = SupabaseClient<Database>
type MemberDeletionRequest =
  Database['public']['Tables']['member_deletion_requests']['Row']
type ChurchDeletionRequest =
  Database['public']['Tables']['church_deletion_requests']['Row']
type ChurchDeletionApproval =
  Database['public']['Tables']['church_deletion_approvals']['Row']
type NestedUser = {
  users?: { email?: string | null; full_name?: string | null } | null
}

export interface ChurchDeletionStatus {
  request: ChurchDeletionRequest
  approvals: (ChurchDeletionApproval & {
    full_name: string | null
    email: string | null
  })[]
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
    kind: 'member' | 'church'
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
    kind: params.kind,
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

async function notifySuperAdmins(
  admin: Admin,
  churchId: string,
  subject: string,
  html: string
) {
  const { data } = await admin
    .from('church_memberships')
    .select('users!church_memberships_user_id_fkey(email)')
    .eq('church_id', churchId)
    .eq('role', 'super_admin')

  const emails = ((data ?? []) as unknown as NestedUser[])
    .map((row) => row.users?.email ?? null)
    .filter((email): email is string => Boolean(email))

  if (!emails.length) return

  try {
    await sendEmail({ to: emails, subject, html })
  } catch (error) {
    console.error('Failed to notify super admins:', error)
  }
}

// ---------------------------------------------------------------------------
// Member deletion
// ---------------------------------------------------------------------------

export async function getMemberDeletionRequest(
  userId: string
): Promise<MemberDeletionRequest | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('member_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()
  return data ?? null
}

export async function requestMemberDeletion(params: {
  userId: string
  reason?: string
}): Promise<MemberDeletionRequest> {
  const admin = createAdminClient()

  const existing = await getMemberDeletionRequest(params.userId)
  if (existing) return existing

  const { data: profile } = await admin
    .from('users')
    .select('email, full_name')
    .eq('id', params.userId)
    .maybeSingle()

  const revertDeadline = new Date(
    Date.now() + MEMBER_REVERT_WINDOW_MS
  ).toISOString()

  const { data: request, error } = await admin
    .from('member_deletion_requests')
    .insert({
      user_id: params.userId,
      user_email: profile?.email ?? null,
      user_name: profile?.full_name ?? null,
      reason: params.reason ?? null,
      revert_deadline: revertDeadline,
    })
    .select()
    .single()

  if (error || !request) {
    throw new Error(error?.message ?? 'Could not create deletion request')
  }

  const { data: memberships } = await admin
    .from('church_memberships')
    .select('church_id')
    .eq('user_id', params.userId)

  for (const membership of memberships ?? []) {
    await writeAudit(admin, {
      churchId: membership.church_id,
      actorId: params.userId,
      action: 'member.deletion_requested',
      entityType: 'member',
      entityId: params.userId,
      metadata: { revert_deadline: revertDeadline },
    })
  }

  await writeEvent(admin, {
    kind: 'member',
    action: 'requested',
    subjectUserId: params.userId,
    subjectName: profile?.full_name ?? null,
    subjectEmail: profile?.email ?? null,
    actorId: params.userId,
    metadata: {
      revert_deadline: revertDeadline,
      churches: memberships?.length ?? 0,
    },
  })

  return request
}

export async function revertMemberDeletion(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const request = await getMemberDeletionRequest(userId)
  if (!request) return false

  await admin
    .from('member_deletion_requests')
    .update({ status: 'reverted', resolved_at: new Date().toISOString() })
    .eq('id', request.id)

  const { data: memberships } = await admin
    .from('church_memberships')
    .select('church_id')
    .eq('user_id', userId)

  for (const membership of memberships ?? []) {
    await writeAudit(admin, {
      churchId: membership.church_id,
      actorId: userId,
      action: 'member.deletion_reverted',
      entityType: 'member',
      entityId: userId,
    })
  }

  await writeEvent(admin, {
    kind: 'member',
    action: 'reverted',
    subjectUserId: userId,
    subjectName: request.user_name,
    subjectEmail: request.user_email,
    actorId: userId,
  })

  return true
}

/** Apply a single member deletion request; returns true once the account is gone. */
async function applyMemberDeletion(
  admin: Admin,
  request: MemberDeletionRequest
): Promise<boolean> {
  if (!request.user_id) {
    await admin
      .from('member_deletion_requests')
      .update({ status: 'completed', resolved_at: new Date().toISOString() })
      .eq('id', request.id)
    return true
  }

  const { data: memberships } = await admin
    .from('church_memberships')
    .select('church_id, role')
    .eq('user_id', request.user_id)

  // If the departing member is a church's only super admin, hand ownership to
  // another leader first (or delete the church if they were the last member) so
  // no church is left without an owner. Non-super memberships are detached by
  // the auth-user cascade below.
  const deletedChurchIds = new Set<string>()
  for (const membership of (memberships ?? []).filter(
    (m) => m.role === 'super_admin'
  )) {
    try {
      const result = await withdrawMembership({
        userId: request.user_id,
        churchId: membership.church_id,
        actorId: request.user_id,
      })
      if (result.status === 'church_deleted') {
        deletedChurchIds.add(membership.church_id)
      }
    } catch (error) {
      console.error(
        'Failed to transfer super admin on account deletion:',
        error
      )
    }
  }

  // `churches.created_by` references `users` without an ON DELETE rule, so a
  // user who created a church cannot be removed while that row still points at
  // them. Detach the creator first (the church itself stays intact) so the
  // account deletion never gets stuck behind a foreign key.
  await admin
    .from('churches')
    .update({ created_by: null })
    .eq('created_by', request.user_id)

  const { error } = await admin.auth.admin.deleteUser(request.user_id)
  if (error) {
    console.error('Failed to delete member account:', error.message)
    return false
  }

  await admin
    .from('member_deletion_requests')
    .update({
      status: 'completed',
      resolved_at: new Date().toISOString(),
      memberships_removed: memberships?.length ?? 0,
    })
    .eq('id', request.id)

  for (const membership of memberships ?? []) {
    // Skip churches that were removed along with this member.
    if (deletedChurchIds.has(membership.church_id)) continue
    await writeAudit(admin, {
      churchId: membership.church_id,
      actorId: null,
      action: 'member.account_deleted',
      entityType: 'member',
      entityId: request.user_id,
      metadata: {
        member_name: request.user_name,
        member_email: request.user_email,
        member_count_delta: -1,
      },
    })
  }

  await writeEvent(admin, {
    kind: 'member',
    action: 'completed',
    subjectUserId: request.user_id,
    subjectName: request.user_name,
    subjectEmail: request.user_email,
    actorId: null,
    metadata: { memberships_removed: memberships?.length ?? 0 },
  })

  return true
}

/**
 * Finalize a specific member's deletion when their revert window has elapsed.
 * Used on access so the account is removed (and the person signed out) even when
 * no scheduler is running.
 */
export async function finalizeMemberDeletionIfDue(
  userId: string
): Promise<boolean> {
  const admin = createAdminClient()
  const { data: request } = await admin
    .from('member_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lte('revert_deadline', new Date().toISOString())
    .maybeSingle()
  if (!request) return false
  return applyMemberDeletion(admin, request)
}

/** Permanently delete member accounts whose revert window has elapsed. */
export async function finalizeMemberDeletions(): Promise<{
  finalized: number
}> {
  const admin = createAdminClient()
  const { data: due } = await admin
    .from('member_deletion_requests')
    .select('*')
    .eq('status', 'pending')
    .lte('revert_deadline', new Date().toISOString())

  let finalized = 0
  for (const request of due ?? []) {
    if (await applyMemberDeletion(admin, request)) finalized += 1
  }
  return { finalized }
}
// ---------------------------------------------------------------------------
// Church deletion
// ---------------------------------------------------------------------------

export async function getChurchDeletionStatus(
  churchId: string
): Promise<ChurchDeletionStatus | null> {
  const admin = createAdminClient()
  const { data: request } = await admin
    .from('church_deletion_requests')
    .select('*')
    .eq('church_id', churchId)
    .in('status', ['pending_approval', 'approved'])
    .maybeSingle()

  if (!request) return null

  const { data: approvals } = await admin
    .from('church_deletion_approvals')
    .select('*, users(full_name, email)')
    .eq('request_id', request.id)

  return {
    request,
    approvals: (
      (approvals ?? []) as unknown as (ChurchDeletionApproval & NestedUser)[]
    ).map((row) => ({
      ...row,
      full_name: row.users?.full_name ?? null,
      email: row.users?.email ?? null,
    })),
  }
}

export async function initiateChurchDeletion(params: {
  churchId: string
  actorId: string
  reason?: string
}): Promise<ChurchDeletionRequest> {
  const admin = createAdminClient()

  const existing = await getChurchDeletionStatus(params.churchId)
  if (existing) {
    throw new Error('A deletion request is already in progress for this church')
  }

  const { data: church } = await admin
    .from('churches')
    .select('id, name, username')
    .eq('id', params.churchId)
    .maybeSingle()
  if (!church) throw new Error('Church not found')

  const { data: superAdmins } = await admin
    .from('church_memberships')
    .select('user_id')
    .eq('church_id', params.churchId)
    .eq('role', 'super_admin')

  const adminIds = (superAdmins ?? []).map((row) => row.user_id)
  if (!adminIds.length) throw new Error('This church has no super admins')

  const now = new Date()
  const allApproved = adminIds.length === 1
  const revertDeadline = allApproved
    ? new Date(now.getTime() + CHURCH_REVERT_WINDOW_MS).toISOString()
    : null

  const { data: request, error } = await admin
    .from('church_deletion_requests')
    .insert({
      church_id: params.churchId,
      church_name: church.name,
      church_username: church.username,
      initiated_by: params.actorId,
      status: allApproved ? 'approved' : 'pending_approval',
      total_super_admins: adminIds.length,
      approvals_required: adminIds.length,
      approvals_granted: 1,
      approved_at: allApproved ? now.toISOString() : null,
      revert_deadline: revertDeadline,
    })
    .select()
    .single()

  if (error || !request) {
    throw new Error(error?.message ?? 'Could not create deletion request')
  }

  await admin.from('church_deletion_approvals').insert(
    adminIds.map((userId) => ({
      request_id: request.id,
      approver_id: userId,
      decision: userId === params.actorId ? 'approved' : 'pending',
      decided_at: userId === params.actorId ? now.toISOString() : null,
    }))
  )

  await writeAudit(admin, {
    churchId: params.churchId,
    actorId: params.actorId,
    action: 'church.deletion_requested',
    entityType: 'church',
    entityId: params.churchId,
    metadata: {
      super_admins: adminIds.length,
      auto_approved: allApproved,
      reason: params.reason ?? null,
    },
  })

  await writeEvent(admin, {
    kind: 'church',
    action: 'requested',
    churchId: params.churchId,
    churchName: church.name,
    actorId: params.actorId,
    subjectEmail: church.username,
    metadata: { super_admins: adminIds.length, auto_approved: allApproved },
  })

  await notifySuperAdmins(
    admin,
    params.churchId,
    `Deletion requested for ${church.name}`,
    `<p>A super admin has started the process to permanently delete <strong>${church.name}</strong>.</p>` +
      (allApproved
        ? `<p>All super admins have accepted. The church will be deleted in 24 hours unless someone reverts it from the Danger zone in the church profile.</p>`
        : `<p>Every super admin must accept this request in the Danger zone of the church profile before it can proceed.</p>`)
  )

  return request
}

export async function decideChurchDeletion(params: {
  churchId: string
  actorId: string
  decision: 'approve' | 'reject'
}): Promise<ChurchDeletionRequest> {
  const admin = createAdminClient()
  const status = await getChurchDeletionStatus(params.churchId)
  if (!status) throw new Error('No deletion request is in progress')
  const request = status.request

  const approval = status.approvals.find(
    (row) => row.approver_id === params.actorId
  )
  if (!approval) throw new Error('You are not a super admin of this church')
  if (approval.decision !== 'pending') {
    throw new Error('You have already responded to this deletion request')
  }

  const now = new Date().toISOString()
  await admin
    .from('church_deletion_approvals')
    .update({
      decision: params.decision === 'approve' ? 'approved' : 'rejected',
      decided_at: now,
    })
    .eq('id', approval.id)

  if (params.decision === 'reject') {
    await admin
      .from('church_deletion_requests')
      .update({ status: 'rejected', resolved_at: now })
      .eq('id', request.id)

    await writeAudit(admin, {
      churchId: params.churchId,
      actorId: params.actorId,
      action: 'church.deletion_rejected',
      entityType: 'church',
      entityId: params.churchId,
    })
    await writeEvent(admin, {
      kind: 'church',
      action: 'rejected',
      churchId: params.churchId,
      churchName: request.church_name,
      actorId: params.actorId,
    })
    await notifySuperAdmins(
      admin,
      params.churchId,
      `Deletion cancelled for ${request.church_name}`,
      `<p>A super admin rejected the request to delete <strong>${request.church_name}</strong>. The church will not be deleted.</p>`
    )
    return { ...request, status: 'rejected', resolved_at: now }
  }

  const granted =
    status.approvals.filter((row) => row.decision === 'approved').length + 1
  const allApproved = granted >= request.approvals_required
  const revertDeadline = allApproved
    ? new Date(Date.now() + CHURCH_REVERT_WINDOW_MS).toISOString()
    : null

  const { data: updated } = await admin
    .from('church_deletion_requests')
    .update({
      approvals_granted: granted,
      status: allApproved ? 'approved' : 'pending_approval',
      approved_at: allApproved ? new Date().toISOString() : null,
      revert_deadline: revertDeadline,
    })
    .eq('id', request.id)
    .select()
    .single()

  await writeEvent(admin, {
    kind: 'church',
    action: allApproved ? 'approved' : 'approval_granted',
    churchId: params.churchId,
    churchName: request.church_name,
    actorId: params.actorId,
    metadata: {
      approvals_granted: granted,
      approvals_required: request.approvals_required,
    },
  })

  if (allApproved) {
    await notifySuperAdmins(
      admin,
      params.churchId,
      `All super admins approved deleting ${request.church_name}`,
      `<p>All super admins have accepted deleting <strong>${request.church_name}</strong>. The church will be permanently deleted in 24 hours unless reverted from the Danger zone.</p>`
    )
  }

  return updated ?? { ...request, approvals_granted: granted }
}

export async function revertChurchDeletion(params: {
  churchId: string
  actorId: string
}): Promise<boolean> {
  const admin = createAdminClient()
  const status = await getChurchDeletionStatus(params.churchId)
  if (!status) return false
  const request = status.request

  await admin
    .from('church_deletion_requests')
    .update({ status: 'reverted', resolved_at: new Date().toISOString() })
    .eq('id', request.id)

  await writeAudit(admin, {
    churchId: params.churchId,
    actorId: params.actorId,
    action: 'church.deletion_reverted',
    entityType: 'church',
    entityId: params.churchId,
  })
  await writeEvent(admin, {
    kind: 'church',
    action: 'reverted',
    churchId: params.churchId,
    churchName: request.church_name,
    actorId: params.actorId,
  })
  await notifySuperAdmins(
    admin,
    params.churchId,
    `Deletion reverted for ${request.church_name}`,
    `<p>A super admin reverted the deletion of <strong>${request.church_name}</strong>. The church is safe.</p>`
  )
  return true
}

/** Permanently delete churches whose grace period has elapsed. */
export async function finalizeChurchDeletions(): Promise<{
  finalized: number
}> {
  const admin = createAdminClient()

  const { data: due } = await admin
    .from('church_deletion_requests')
    .select('*')
    .eq('status', 'approved')
    .lte('revert_deadline', new Date().toISOString())

  let finalized = 0
  for (const request of due ?? []) {
    const { count } = await admin
      .from('church_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', request.church_id)

    const emails = await (async () => {
      const { data } = await admin
        .from('church_memberships')
        .select('users!church_memberships_user_id_fkey(email)')
        .eq('church_id', request.church_id)
        .eq('role', 'super_admin')
      return ((data ?? []) as unknown as NestedUser[])
        .map((row) => row.users?.email ?? null)
        .filter((email): email is string => Boolean(email))
    })()

    const { error } = await admin
      .from('churches')
      .delete()
      .eq('id', request.church_id)
    if (error) {
      console.error('Failed to delete church:', error.message)
      continue
    }

    await admin
      .from('church_deletion_requests')
      .update({ status: 'completed', resolved_at: new Date().toISOString() })
      .eq('id', request.id)

    await writeEvent(admin, {
      kind: 'church',
      action: 'completed',
      churchId: request.church_id,
      churchName: request.church_name,
      actorId: request.initiated_by,
      metadata: { members_detached: count ?? 0 },
    })

    if (emails.length) {
      try {
        await sendEmail({
          to: emails,
          subject: `${request.church_name} has been deleted`,
          html: `<p><strong>${request.church_name}</strong> has been permanently deleted and its members detached.</p>`,
        })
      } catch (error) {
        console.error('Failed to notify super admins of deletion:', error)
      }
    }

    finalized += 1
  }

  return { finalized }
}
