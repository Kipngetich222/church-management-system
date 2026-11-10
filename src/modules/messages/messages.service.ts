import { ForbiddenException, HttpException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { SupabaseService } from '../../supabase/supabase.service'
import { EmailService } from './email.service'
import { SmsService } from './sms.service'
import { SendMessageDto } from './message.dto'
import {
  CommunicationEngine,
  communicationDb,
  checked,
} from './communication-engine'
import { CommunicationError, type RecipientFilter } from './communication.types'

@Injectable()
export class MessagesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly sms: SmsService,
    private readonly email: EmailService
  ) {}
  get engine() {
    return new CommunicationEngine(communicationDb(this.supabase.admin), {
      environment: this.sms.configuration.environment,
      ensureSmsConfigured: () => this.sms.ensureConfigured(),
      normalizePhone: (phone) => this.sms.normalizePhone(phone),
      sendSms: (to, body) => this.sms.send({ to, message: body }),
      sendEmail: async (to, subject, body) => {
        if (!this.email.configured)
          throw new Error('Email sending is not configured')
        const html = body
          .replace(
            /[&<>"']/g,
            (char) =>
              ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
              })[char]!
          )
          .replace(/\n/g, '<br />')
        const result = await this.email.send({ to, subject, html })
        if ('error' in result && result.error)
          throw new Error(result.error.message)
      },
    })
  }
  private async authorize(churchId: string, userId: string) {
    const actor = checked(
      await this.supabase.admin
        .from('church_memberships')
        .select('role,status')
        .eq('church_id', churchId)
        .eq('user_id', userId)
        .maybeSingle()
    )
    if (
      !actor ||
      actor.status !== 'active' ||
      !['super_admin', 'dept_admin'].includes(actor.role)
    )
      throw new ForbiddenException('Active church administrator required')
  }
  async listMessages(churchId: string, userId: string, limit = 100) {
    await this.authorize(churchId, userId)
    const { data, error } = await this.supabase.admin
      .from('messages')
      .select(
        '*, church_memberships(id, users!church_memberships_user_id_fkey(full_name, email))'
      )
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return this.supabase.unwrap(data ?? [], error)
  }
  async listMyMessages(churchId: string, membershipId: string) {
    const { data, error } = await this.supabase.admin
      .from('messages')
      .select('*')
      .eq('church_id', churchId)
      .eq('membership_id', membershipId)
      .order('created_at', { ascending: false })
    return this.supabase.unwrap(data ?? [], error)
  }
  async listCampaigns(churchId: string, userId: string) {
    await this.authorize(churchId, userId)
    const { data, error } = await this.supabase.admin
      .from('message_campaigns')
      .select('*')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
    return this.supabase.unwrap(data ?? [], error)
  }
  async send(churchId: string, dto: SendMessageDto, userId: string) {
    await this.authorize(churchId, userId)
    try {
      const campaign = await this.engine.create(
        {
          churchId,
          channel: dto.channel,
          body: dto.body,
          subject: dto.subject,
          scheduledAt: dto.scheduledAt,
          requestId: dto.requestId ?? randomUUID(),
          recipientFilter: (dto.recipientFilter ?? {
            type: dto.membershipIds ? 'custom' : 'all',
            ids: dto.membershipIds ?? [],
          }) as RecipientFilter,
        },
        userId
      )
      return {
        campaignId: campaign.id,
        totalRecipients: campaign.total_recipients,
        status: campaign.status,
        error: campaign.error,
      }
    } catch (error) {
      if (error instanceof CommunicationError)
        throw new HttpException(error.message, error.status)
      throw error
    }
  }
}
