import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CommunicationError,
  smsSegments,
  validateCampaign,
  type Campaign,
  type CampaignInput,
  type Message,
  type Recipient,
  type RecipientFilter,
  type SmsEnvironment,
} from './communication.types'
import type { SmsProviderResult } from './africas-talking'

// A single adapter boundary for new migration types, shared by both API hosts.
export function communicationDb(client: unknown): SupabaseClient {
  return client as SupabaseClient
}
export function checked<T>(result: {
  data: T
  error: { message: string } | null
}): T {
  if (result.error) throw new CommunicationError(result.error.message)
  return result.data
}
type Prepared = {
  membership_id: string
  recipient_name: string
  to_address: string
  status: 'sending' | 'failed'
  error: string | null
}
type Outcome = {
  id: string
  status: 'sent' | 'failed' | 'sending'
  error?: string | null
  provider_id?: string
  provider_response?: unknown
}
export type CommunicationTransport = {
  environment: SmsEnvironment
  normalizePhone: (phone: string) => string
  ensureSmsConfigured: () => void
  sendSms: (to: string[], body: string) => Promise<SmsProviderResult>
  sendEmail: (to: string, subject: string, body: string) => Promise<void>
}

export class CommunicationEngine {
  constructor(
    public readonly db: SupabaseClient,
    public readonly transport: CommunicationTransport
  ) {}

  async recipients(
    churchId: string,
    actorId: string | null,
    filter: RecipientFilter
  ): Promise<Recipient[]> {
    return (
      checked(
        await this.db.rpc('communication_recipients', {
          p_church: churchId,
          p_actor: actorId,
          p_filter: filter,
        })
      ) ?? []
    )
  }

  prepare(
    recipients: Recipient[],
    channel: CampaignInput['channel']
  ): Prepared[] {
    const addresses = new Set<string>()
    return recipients.map((recipient) => {
      let address = ''
      let error: string | null = null
      if (channel === 'sms') {
        try {
          address = recipient.phone
            ? this.transport.normalizePhone(recipient.phone)
            : ''
        } catch {
          /* Invalid contact is recorded below. */
        }
        if (!/^\+[1-9]\d{7,14}$/.test(address))
          error = 'Missing or invalid phone number'
      } else if (channel === 'email') {
        address = recipient.email?.trim().toLowerCase() ?? ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
          error = 'Missing or invalid email address'
      } else {
        address = recipient.user_id ?? ''
        if (!address) error = 'Member has no online account'
      }
      if (!error && addresses.has(address))
        error = 'Duplicate recipient address; sent once'
      if (!error) addresses.add(address)
      return {
        membership_id: recipient.membership_id,
        recipient_name: recipient.name,
        to_address: address || 'unavailable',
        status: error ? 'failed' : 'sending',
        error,
      }
    })
  }

  async preview(input: CampaignInput, actorId: string | null) {
    validateCampaign(input)
    const recipients = await this.recipients(
      input.churchId,
      actorId,
      input.recipientFilter
    )
    const rows = this.prepare(recipients, input.channel)
    const reachable = rows.filter((row) => row.status === 'sending').length
    const parts = input.channel === 'sms' ? smsSegments(input.body) : 0
    return {
      recipients: rows.length,
      reachable,
      skipped: rows.length - reachable,
      parts,
      credits: reachable * parts,
    }
  }

  async create(
    input: CampaignInput,
    actorId: string | null,
    source = 'manual'
  ) {
    validateCampaign(input)
    if (!actorId && source === 'manual')
      throw new CommunicationError('Administrator required', 403)
    const existing = checked(
      await this.db
        .from('message_campaigns')
        .select('*')
        .eq('church_id', input.churchId)
        .eq('request_id', input.requestId)
        .maybeSingle()
    ) as Campaign | null
    if (existing) return existing
    if (input.channel === 'sms') this.transport.ensureSmsConfigured()
    const preview = await this.preview(input, actorId)
    if (!preview.reachable)
      throw new CommunicationError(
        'No reachable recipients match this selection'
      )
    let name = source === 'manual' ? 'Administrator' : `Automation: ${source}`
    if (actorId) {
      const actor = checked(
        await this.db
          .from('users')
          .select('full_name, email')
          .eq('id', actorId)
          .single()
      )
      name = actor?.full_name || actor?.email || name
    }
    const result = await this.db
      .from('message_campaigns')
      .insert({
        church_id: input.churchId,
        channel: input.channel,
        body: input.body,
        subject: input.subject ?? null,
        recipient_filter: input.recipientFilter,
        scheduled_at: input.scheduledAt ?? null,
        status: input.scheduledAt ? 'scheduled' : 'queued',
        total_recipients: preview.recipients,
        created_by: actorId,
        created_by_name: name,
        sms_environment: this.transport.environment,
        request_id: input.requestId,
        source,
      })
      .select('*')
      .single()
    if (result.error?.code === '23505') {
      return checked(
        await this.db
          .from('message_campaigns')
          .select('*')
          .eq('church_id', input.churchId)
          .eq('request_id', input.requestId)
          .single()
      ) as Campaign
    }
    const campaign = checked(result) as Campaign
    if (!input.scheduledAt) await this.dispatch(campaign.id)
    return checked(
      await this.db
        .from('message_campaigns')
        .select('*')
        .eq('id', campaign.id)
        .single()
    ) as Campaign
  }

  async dispatch(id: string) {
    const campaign = checked(
      await this.db.rpc('claim_message_campaign', {
        p_id: id,
        p_environment: this.transport.environment,
      })
    ) as Campaign | null
    if (!campaign?.id) return false
    let messages: Message[] = []
    try {
      if (campaign.source === 'manual' && !campaign.created_by)
        throw new CommunicationError('Original sender no longer has an account')
      if (campaign.channel === 'sms') this.transport.ensureSmsConfigured()
      const recipients = await this.recipients(
        campaign.church_id,
        campaign.created_by,
        campaign.recipient_filter
      )
      const rows = this.prepare(recipients, campaign.channel)
      if (!rows.some((row) => row.status === 'sending'))
        throw new CommunicationError(
          'No reachable recipients remain in the selected audience'
        )
      messages = checked(
        await this.db.rpc('prepare_message_campaign', {
          p_id: id,
          p_rows: rows,
          p_parts: campaign.channel === 'sms' ? smsSegments(campaign.body) : 0,
        })
      ) as Message[]
    } catch (error) {
      // No provider call has happened; preparation/reservation is transactional.
      checked(
        await this.db
          .from('message_campaigns')
          .update({
            status: 'failed',
            error:
              error instanceof Error
                ? error.message
                : 'Unable to prepare messages',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
      )
      return false
    }
    const sending = messages.filter((message) => message.status === 'sending')
    for (let offset = 0; offset < sending.length; offset += 100) {
      const batch = sending.slice(offset, offset + 100)
      let outcomes: Outcome[]
      if (campaign.channel === 'sms') {
        try {
          const response = await this.transport.sendSms(
            batch.map((row) => row.to_address),
            campaign.body
          )
          outcomes = batch.map((message) => {
            const matches = response.SMSMessageData.Recipients.filter(
              (recipient) => {
                try {
                  return (
                    this.transport.normalizePhone(recipient.number) ===
                    message.to_address
                  )
                } catch {
                  return false
                }
              }
            )
            if (matches.length !== 1)
              return {
                id: message.id,
                status: 'sending',
                error:
                  'Provider did not return a unique recipient result; review before resending',
              }
            const recipient = matches[0]
            const accepted =
              recipient.status === 'Success' ||
              recipient.statusCode === 101 ||
              recipient.statusCode === 102
            return {
              id: message.id,
              status: accepted ? 'sent' : 'failed',
              error: accepted ? null : recipient.status,
              provider_id: recipient.messageId,
              provider_response: recipient,
            }
          })
        } catch {
          outcomes = batch.map((message) => ({
            id: message.id,
            status: 'sending',
            error:
              'Provider outcome is unknown. Credits remain held; review before resending.',
          }))
        }
      } else if (campaign.channel === 'in_app') {
        outcomes = batch.map((message) => ({ id: message.id, status: 'sent' }))
      } else {
        outcomes = []
        for (const message of batch) {
          try {
            await this.transport.sendEmail(
              message.to_address,
              campaign.subject || 'Message from your church',
              campaign.body
            )
            outcomes.push({ id: message.id, status: 'sent' })
          } catch (error) {
            outcomes.push({
              id: message.id,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Email failed',
            })
          }
        }
      }
      // Durable result + charge/release in one transaction. Never retry a
      // provider call when persisting its result fails.
      checked(
        await this.db.rpc('settle_message_batch', {
          p_id: id,
          p_results: outcomes,
        })
      )
    }
    return true
  }

  async runScheduled(limit = 10) {
    const campaigns =
      checked(
        await this.db
          .from('message_campaigns')
          .select('id')
          .eq('sms_environment', this.transport.environment)
          .in('status', ['queued', 'scheduled'])
          .or(
            `scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`
          )
          .order('created_at')
          .limit(limit)
      ) ?? []
    const results: { id: string; processed: boolean; error?: string }[] = []
    for (const campaign of campaigns) {
      try {
        results.push({
          id: campaign.id,
          processed: await this.dispatch(campaign.id),
        })
      } catch {
        results.push({
          id: campaign.id,
          processed: false,
          error: 'Persistence failed; review this campaign before resending',
        })
      }
    }
    // A killed process cannot safely resend messages whose provider outcome is
    // unknown. Surface stale claims and retain their credit reservations.
    checked(
      await this.db
        .from('message_campaigns')
        .update({
          status: 'review',
          error:
            'Sending was interrupted. Review provider delivery before resending.',
          updated_at: new Date().toISOString(),
        })
        .eq('sms_environment', this.transport.environment)
        .eq('status', 'sending')
        .lt('updated_at', new Date(Date.now() - 15 * 60000).toISOString())
    )
    return results
  }
}
