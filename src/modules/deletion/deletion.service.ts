import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'
import { AuditService } from '../audit/audit.service'
import { EmailService } from '../messages/email.service'
import { MembershipsService } from '../memberships/memberships.service'

/**
 * Reversible account deletion, mirrored from the web app so the documented REST
 * API (used by the mobile client) supports the same flows:
 *
 *  - Member deletion: request, revert within 10 minutes, otherwise the account
 *    is deleted permanently. Deleting the auth user cascades to the member's
 *    church memberships, so church member counts adjust automatically.
 *  - Church deletion: a super admin starts it; every super admin must accept;
 *    once all accept there is a 24 hour window to revert before permanent
 *    deletion (which detaches all members via cascade).
 *
 * Every transition is recorded in `deletion_events` and, while the church still
 * exists, in its `audit_logs`.
 */
@Injectable()
export class DeletionService {
  private readonly logger = new Logger(DeletionService.name)

  /** Members get 10 minutes to undo a deletion request. */
  static readonly MEMBER_REVERT_WINDOW_MS = 10 * 60 * 1000
  /** Once all super admins approve, they get 24 hours to undo. */
  static readonly CHURCH_REVERT_WINDOW_MS = 24 * 60 * 60 * 1000

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly memberships: MembershipsService
  ) {}

  private async writeEvent(params: {
    kind: 'member' | 'church'
    action: string
    churchId?: string | null
    churchName?: string | null
    subjectUserId?: string | null
    subjectName?: string | null
    subjectEmail?: string | null
    actorId?: string | null
    metadata?: Record<string, unknown>
  }) {
    await this.supabase.admin.from('deletion_events').insert({
      kind: params.kind,
      action: params.action,
      church_id: params.churchId ?? null,
      church_name: params.churchName ?? null,
      subject_user_id: params.subjectUserId ?? null,
      subject_name: params.subjectName ?? null,
      subject_email: params.subjectEmail ?? null,
      actor_id: params.actorId ?? null,
      metadata: (params.metadata ?? {}) as any,
    })
  }

  private async notifySuperAdmins(
    churchId: string,
    subject: string,
    html: string
  ) {
    const { data } = await this.supabase.admin
      .from('church_memberships')
      .select('users!church_memberships_user_id_fkey(email)')
      .eq('church_id', churchId)
      .eq('role', 'super_admin')

    const emails = (data ?? [])
      .map((row: any) => row.users?.email as string | undefined)
      .filter((email): email is string => Boolean(email))

    if (!emails.length) return
    try {
      await this.email.send({ to: emails, subject, html })
    } catch (error) {
      this.logger.warn(
        `Failed to notify super admins: ${(error as Error).message}`
      )
    }
  }

  // -------------------------------------------------------------------------
  // Member deletion
  // -------------------------------------------------------------------------

  async getMemberRequest(userId: string) {
    const { data } = await this.supabase.admin
      .from('member_deletion_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()
    return data ?? null
  }

  async requestMemberDeletion(userId: string, reason?: string) {
    const existing = await this.getMemberRequest(userId)
    if (existing) return existing

    const { data: profile } = await this.supabase.admin
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle()

    const revertDeadline = new Date(
      Date.now() + DeletionService.MEMBER_REVERT_WINDOW_MS
    ).toISOString()

    const { data: request, error } = await this.supabase.admin
      .from('member_deletion_requests')
      .insert({
        user_id: userId,
        user_email: profile?.email ?? null,
        user_name: profile?.full_name ?? null,
        reason: reason ?? null,
        revert_deadline: revertDeadline,
      })
      .select()
      .single()
    if (error || !request) {
      throw new BadRequestException(
        error?.message ?? 'Could not create deletion request'
      )
    }

    const { data: memberships } = await this.supabase.admin
      .from('church_memberships')
      .select('church_id')
      .eq('user_id', userId)

    for (const membership of memberships ?? []) {
      await this.audit.log({
        churchId: membership.church_id,
        actorId: userId,
        action: 'member.deletion_requested',
        entityType: 'member',
        entityId: userId,
        metadata: { revert_deadline: revertDeadline },
      })
    }

    await this.writeEvent({
      kind: 'member',
      action: 'requested',
      subjectUserId: userId,
      subjectName: profile?.full_name ?? null,
      subjectEmail: profile?.email ?? null,
      actorId: userId,
      metadata: {
        revert_deadline: revertDeadline,
        churches: memberships?.length ?? 0,
      },
    })

    return request
  }

  async revertMemberDeletion(userId: string) {
    const request = await this.getMemberRequest(userId)
    if (!request) return { reverted: false }

    await this.supabase.admin
      .from('member_deletion_requests')
      .update({ status: 'reverted', resolved_at: new Date().toISOString() })
      .eq('id', request.id)

    const { data: memberships } = await this.supabase.admin
      .from('church_memberships')
      .select('church_id')
      .eq('user_id', userId)

    for (const membership of memberships ?? []) {
      await this.audit.log({
        churchId: membership.church_id,
        actorId: userId,
        action: 'member.deletion_reverted',
        entityType: 'member',
        entityId: userId,
      })
    }

    await this.writeEvent({
      kind: 'member',
      action: 'reverted',
      subjectUserId: userId,
      subjectName: request.user_name,
      subjectEmail: request.user_email,
      actorId: userId,
    })

    return { reverted: true }
  }

  async finalizeMemberDeletions() {
    const { data: due } = await this.supabase.admin
      .from('member_deletion_requests')
      .select('*')
      .eq('status', 'pending')
      .lte('revert_deadline', new Date().toISOString())

    let finalized = 0
    for (const request of due ?? []) {
      if (!request.user_id) {
        await this.supabase.admin
          .from('member_deletion_requests')
          .update({
            status: 'completed',
            resolved_at: new Date().toISOString(),
          })
          .eq('id', request.id)
        continue
      }

      const { data: memberships } = await this.supabase.admin
        .from('church_memberships')
        .select('church_id, role')
        .eq('user_id', request.user_id)

      // Hand off any church where the departing member is the only super admin
      // so it is never left without an owner (or delete it when empty).
      const deletedChurchIds = new Set<string>()
      for (const membership of (memberships ?? []).filter(
        (m) => m.role === 'super_admin'
      )) {
        try {
          const result = await this.memberships.withdraw(
            request.user_id,
            membership.church_id
          )
          if (result.status === 'church_deleted') {
            deletedChurchIds.add(membership.church_id)
          }
        } catch (error) {
          this.logger.error(
            `Failed to transfer super admin on deletion: ${(error as Error).message}`
          )
        }
      }

      // `churches.created_by` has no ON DELETE rule, so detach the creator
      // before removing the account to avoid a foreign-key block.
      await this.supabase.admin
        .from('churches')
        .update({ created_by: null })
        .eq('created_by', request.user_id)

      const { error } = await this.supabase.admin.auth.admin.deleteUser(
        request.user_id
      )
      if (error) {
        this.logger.error(`Failed to delete member account: ${error.message}`)
        continue
      }

      await this.supabase.admin
        .from('member_deletion_requests')
        .update({
          status: 'completed',
          resolved_at: new Date().toISOString(),
          memberships_removed: memberships?.length ?? 0,
        })
        .eq('id', request.id)

      for (const membership of memberships ?? []) {
        if (deletedChurchIds.has(membership.church_id)) continue
        await this.audit.log({
          churchId: membership.church_id,
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

      await this.writeEvent({
        kind: 'member',
        action: 'completed',
        subjectUserId: request.user_id,
        subjectName: request.user_name,
        subjectEmail: request.user_email,
        actorId: null,
        metadata: { memberships_removed: memberships?.length ?? 0 },
      })

      finalized += 1
    }

    return { finalized }
  }

  // -------------------------------------------------------------------------
  // Church deletion
  // -------------------------------------------------------------------------

  async getChurchStatus(churchId: string) {
    const { data: request } = await this.supabase.admin
      .from('church_deletion_requests')
      .select('*')
      .eq('church_id', churchId)
      .in('status', ['pending_approval', 'approved'])
      .maybeSingle()
    if (!request) return null

    const { data: approvals } = await this.supabase.admin
      .from('church_deletion_approvals')
      .select('*, users(full_name, email)')
      .eq('request_id', request.id)

    return {
      request,
      approvals: (approvals ?? []).map((row: any) => ({
        ...row,
        full_name: row.users?.full_name ?? null,
        email: row.users?.email ?? null,
      })),
    }
  }

  async initiateChurchDeletion(
    churchId: string,
    actorId: string,
    reason?: string
  ) {
    const existing = await this.getChurchStatus(churchId)
    if (existing) {
      throw new BadRequestException('A deletion request is already in progress')
    }

    const { data: church } = await this.supabase.admin
      .from('churches')
      .select('id, name, username')
      .eq('id', churchId)
      .maybeSingle()
    if (!church) throw new NotFoundException('Church not found')

    const { data: superAdmins } = await this.supabase.admin
      .from('church_memberships')
      .select('user_id')
      .eq('church_id', churchId)
      .eq('role', 'super_admin')

    const adminIds = (superAdmins ?? []).map((row) => row.user_id)
    if (!adminIds.length)
      throw new BadRequestException('This church has no super admins')

    const now = new Date()
    const allApproved = adminIds.length === 1
    const revertDeadline = allApproved
      ? new Date(
          now.getTime() + DeletionService.CHURCH_REVERT_WINDOW_MS
        ).toISOString()
      : null

    const { data: request, error } = await this.supabase.admin
      .from('church_deletion_requests')
      .insert({
        church_id: churchId,
        church_name: church.name,
        church_username: church.username,
        initiated_by: actorId,
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
      throw new BadRequestException(
        error?.message ?? 'Could not create deletion request'
      )
    }

    await this.supabase.admin.from('church_deletion_approvals').insert(
      adminIds.map((userId) => ({
        request_id: request.id,
        approver_id: userId,
        decision: userId === actorId ? 'approved' : 'pending',
        decided_at: userId === actorId ? now.toISOString() : null,
      }))
    )

    await this.audit.log({
      churchId,
      actorId,
      action: 'church.deletion_requested',
      entityType: 'church',
      entityId: churchId,
      metadata: {
        super_admins: adminIds.length,
        auto_approved: allApproved,
        reason: reason ?? null,
      },
    })

    await this.writeEvent({
      kind: 'church',
      action: 'requested',
      churchId,
      churchName: church.name,
      actorId,
      metadata: { super_admins: adminIds.length, auto_approved: allApproved },
    })

    await this.notifySuperAdmins(
      churchId,
      `Deletion requested for ${church.name}`,
      `<p>A super admin started the process to permanently delete <strong>${church.name}</strong>.</p>` +
        (allApproved
          ? '<p>All super admins accepted. It will be deleted in 24 hours unless reverted.</p>'
          : '<p>Every super admin must accept this request before it can proceed.</p>')
    )

    return request
  }

  async decideChurchDeletion(
    churchId: string,
    actorId: string,
    decision: 'approve' | 'reject'
  ) {
    const status = await this.getChurchStatus(churchId)
    if (!status)
      throw new BadRequestException('No deletion request is in progress')
    const request = status.request

    const approval = status.approvals.find((row) => row.approver_id === actorId)
    if (!approval)
      throw new BadRequestException('You are not a super admin of this church')
    if (approval.decision !== 'pending') {
      throw new BadRequestException(
        'You have already responded to this deletion request'
      )
    }

    const now = new Date().toISOString()
    await this.supabase.admin
      .from('church_deletion_approvals')
      .update({
        decision: decision === 'approve' ? 'approved' : 'rejected',
        decided_at: now,
      })
      .eq('id', approval.id)

    if (decision === 'reject') {
      await this.supabase.admin
        .from('church_deletion_requests')
        .update({ status: 'rejected', resolved_at: now })
        .eq('id', request.id)

      await this.audit.log({
        churchId,
        actorId,
        action: 'church.deletion_rejected',
        entityType: 'church',
        entityId: churchId,
      })
      await this.writeEvent({
        kind: 'church',
        action: 'rejected',
        churchId,
        churchName: request.church_name,
        actorId,
      })
      await this.notifySuperAdmins(
        churchId,
        `Deletion cancelled for ${request.church_name}`,
        `<p>A super admin rejected the deletion of <strong>${request.church_name}</strong>. The church will not be deleted.</p>`
      )
      return { ...request, status: 'rejected', resolved_at: now }
    }

    const granted =
      status.approvals.filter((row) => row.decision === 'approved').length + 1
    const allApproved = granted >= request.approvals_required
    const revertDeadline = allApproved
      ? new Date(
          Date.now() + DeletionService.CHURCH_REVERT_WINDOW_MS
        ).toISOString()
      : null

    const { data: updated } = await this.supabase.admin
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

    await this.writeEvent({
      kind: 'church',
      action: allApproved ? 'approved' : 'approval_granted',
      churchId,
      churchName: request.church_name,
      actorId,
      metadata: {
        approvals_granted: granted,
        approvals_required: request.approvals_required,
      },
    })

    if (allApproved) {
      await this.notifySuperAdmins(
        churchId,
        `All super admins approved deleting ${request.church_name}`,
        `<p>All super admins accepted deleting <strong>${request.church_name}</strong>. It will be deleted in 24 hours unless reverted.</p>`
      )
    }

    return updated ?? { ...request, approvals_granted: granted }
  }

  async revertChurchDeletion(churchId: string, actorId: string) {
    const status = await this.getChurchStatus(churchId)
    if (!status) return { reverted: false }
    const request = status.request

    await this.supabase.admin
      .from('church_deletion_requests')
      .update({ status: 'reverted', resolved_at: new Date().toISOString() })
      .eq('id', request.id)

    await this.audit.log({
      churchId,
      actorId,
      action: 'church.deletion_reverted',
      entityType: 'church',
      entityId: churchId,
    })
    await this.writeEvent({
      kind: 'church',
      action: 'reverted',
      churchId,
      churchName: request.church_name,
      actorId,
    })
    await this.notifySuperAdmins(
      churchId,
      `Deletion reverted for ${request.church_name}`,
      `<p>A super admin reverted the deletion of <strong>${request.church_name}</strong>. The church is safe.</p>`
    )
    return { reverted: true }
  }

  async finalizeChurchDeletions() {
    const { data: due } = await this.supabase.admin
      .from('church_deletion_requests')
      .select('*')
      .eq('status', 'approved')
      .lte('revert_deadline', new Date().toISOString())

    let finalized = 0
    for (const request of due ?? []) {
      const { count } = await this.supabase.admin
        .from('church_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('church_id', request.church_id)

      const { data: adminRows } = await this.supabase.admin
        .from('church_memberships')
        .select('users!church_memberships_user_id_fkey(email)')
        .eq('church_id', request.church_id)
        .eq('role', 'super_admin')
      const emails = (adminRows ?? [])
        .map((row: any) => row.users?.email as string | undefined)
        .filter((email): email is string => Boolean(email))

      const { error } = await this.supabase.admin
        .from('churches')
        .delete()
        .eq('id', request.church_id)
      if (error) {
        this.logger.error(`Failed to delete church: ${error.message}`)
        continue
      }

      await this.supabase.admin
        .from('church_deletion_requests')
        .update({ status: 'completed', resolved_at: new Date().toISOString() })
        .eq('id', request.id)

      await this.writeEvent({
        kind: 'church',
        action: 'completed',
        churchId: request.church_id,
        churchName: request.church_name,
        actorId: request.initiated_by,
        metadata: { members_detached: count ?? 0 },
      })

      if (emails.length) {
        try {
          await this.email.send({
            to: emails,
            subject: `${request.church_name} has been deleted`,
            html: `<p><strong>${request.church_name}</strong> has been permanently deleted and its members detached.</p>`,
          })
        } catch (error) {
          this.logger.warn(
            `Failed to notify super admins: ${(error as Error).message}`
          )
        }
      }

      finalized += 1
    }

    return { finalized }
  }
}
