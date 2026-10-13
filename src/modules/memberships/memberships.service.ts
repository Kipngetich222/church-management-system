import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'
import type { Json } from '../../types/database'
import { AuditService } from '../audit/audit.service'
import { EmailService } from '../messages/email.service'

type WithdrawalResult = {
  status: 'left' | 'church_deleted' | 'not_a_member'
  church_id: string
  church_name: string | null
  role?: string
  members_remaining?: number
  promoted_membership_id?: string | null
  promoted_user_id?: string | null
  promoted_name?: string | null
}

type NestedUser = {
  users?: { email?: string | null } | null
}

/**
 * Single-church membership withdrawal for the REST API (mobile client).
 *
 * Mirrors the web app so a member can leave one church, keep their account and
 * other churches, and join another church later. When the caller is the church's
 * only super admin the database hands ownership to another leader (or deletes
 * the church when nobody is left) as part of `public.withdraw_membership`.
 */
@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditService,
    private readonly email: EmailService
  ) {}

  private async writeEvent(params: {
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

  private async notify(churchId: string, subject: string, html: string) {
    const { data } = await this.supabase.admin
      .from('church_memberships')
      .select('users(email)')
      .eq('church_id', churchId)
      .eq('role', 'super_admin')

    const emails = ((data ?? []) as unknown as NestedUser[])
      .map((row) => row.users?.email ?? null)
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

  async withdraw(userId: string, churchId: string) {
    const { data: profile } = await this.supabase.admin
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle()

    const { data, error } = await this.supabase.admin.rpc(
      'withdraw_membership',
      {
        p_user_id: userId,
        p_church_id: churchId,
      }
    )
    if (error) throw new BadRequestException(error.message)

    const result = data as unknown as WithdrawalResult
    if (result.status === 'not_a_member') return result

    const churchLabel = result.church_name ?? 'the church'

    if (result.status === 'church_deleted') {
      await this.writeEvent({
        action: 'church_deleted',
        churchId: result.church_id,
        churchName: result.church_name,
        subjectUserId: userId,
        subjectName: profile?.full_name ?? null,
        subjectEmail: profile?.email ?? null,
        actorId: userId,
        metadata: {
          reason: 'last_member_withdrew',
          members_removed: result.members_remaining ?? null,
        },
      })
      return result
    }

    await this.audit.log({
      churchId,
      actorId: userId,
      action: 'membership.withdrawn',
      entityType: 'member',
      entityId: userId,
      metadata: {
        member_name: profile?.full_name ?? null,
        member_email: profile?.email ?? null,
        role: result.role ?? 'member',
        members_remaining: result.members_remaining ?? null,
      },
    })

    if (result.promoted_user_id) {
      await this.audit.log({
        churchId,
        actorId: userId,
        action: 'membership.super_admin_transferred',
        entityType: 'member',
        entityId: result.promoted_user_id,
        metadata: { previous_super_admin: userId },
      })
      await this.notifyPromoted(result, churchLabel)
    }

    await this.writeEvent({
      action: result.promoted_user_id
        ? 'withdrawn_super_admin_transferred'
        : 'withdrawn',
      churchId: result.church_id,
      churchName: result.church_name,
      subjectUserId: userId,
      subjectName: profile?.full_name ?? null,
      subjectEmail: profile?.email ?? null,
      actorId: userId,
      metadata: {
        role: result.role ?? 'member',
        promoted_user_id: result.promoted_user_id ?? null,
        members_remaining: result.members_remaining ?? null,
      },
    })

    await this.notify(
      churchId,
      `A member withdrew from ${churchLabel}`,
      `<p><strong>${profile?.full_name ?? 'A member'}</strong> has withdrawn from <strong>${churchLabel}</strong>.</p>`
    )

    return result
  }

  private async notifyPromoted(result: WithdrawalResult, churchLabel: string) {
    if (!result.promoted_user_id) return
    const { data: promoted } = await this.supabase.admin
      .from('users')
      .select('email, full_name')
      .eq('id', result.promoted_user_id)
      .maybeSingle()
    if (!promoted?.email) return
    try {
      await this.email.send({
        to: promoted.email,
        subject: `You are now the super admin of ${churchLabel}`,
        html: `<p>Hi ${promoted.full_name ?? 'there'},</p><p>The previous super admin left <strong>${churchLabel}</strong>, so you have been made its super admin.</p>`,
      })
    } catch (error) {
      this.logger.warn(
        `Failed to notify promoted super admin: ${(error as Error).message}`
      )
    }
  }
}
