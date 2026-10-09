import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { SendMessageDto } from './message.dto';

interface Recipient {
  membershipId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
  ) {}

  async listMessages(churchId: string, limit = 100) {
    const { data, error } = await this.supabase.admin
      .from('messages')
      .select('*, church_memberships(id, users(full_name, email))')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return this.supabase.unwrap(data ?? [], error);
  }

  async listMyMessages(churchId: string, membershipId: string) {
    const { data, error } = await this.supabase.admin
      .from('messages')
      .select('*')
      .eq('church_id', churchId)
      .eq('membership_id', membershipId)
      .order('created_at', { ascending: false });
    return this.supabase.unwrap(data ?? [], error);
  }

  async listCampaigns(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('message_campaigns')
      .select('*')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false });
    return this.supabase.unwrap(data ?? [], error);
  }

  async send(churchId: string, dto: SendMessageDto, userId: string) {
    const admin = this.supabase.admin;

    const { data: campaign, error: campaignError } = await admin
      .from('message_campaigns')
      .insert({
        church_id: churchId,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        recipient_filter: (dto.recipientFilter ?? { type: 'all' }) as any,
        status: 'sending',
        created_by: userId,
      })
      .select()
      .single();

    const created = this.supabase.unwrap(campaign, campaignError);

    const recipients = await this.resolveRecipients(churchId, dto);

    await admin
      .from('message_campaigns')
      .update({ total_recipients: recipients.length })
      .eq('id', created.id);

    if (dto.channel === 'sms') {
      await this.dispatchSms(churchId, created.id, recipients, dto.body);
    } else if (dto.channel === 'email') {
      await this.dispatchEmail(churchId, created.id, recipients, dto);
    }

    await admin
      .from('message_campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', created.id);

    return { campaignId: created.id, totalRecipients: recipients.length };
  }

  private async resolveRecipients(churchId: string, dto: SendMessageDto): Promise<Recipient[]> {
    const admin = this.supabase.admin;
    const filter = dto.recipientFilter ?? { type: 'all' };
    const ids = dto.membershipIds ?? filter.ids ?? [];

    let membershipIds: string[] | null = null;

    if (filter.type === 'department' && ids.length) {
      const { data } = await admin
        .from('department_members')
        .select('membership_id')
        .in('department_id', ids);
      membershipIds = (data ?? []).map((row) => row.membership_id);
    } else if (filter.type === 'group' && ids.length) {
      const { data } = await admin
        .from('small_group_members')
        .select('membership_id')
        .in('group_id', ids);
      membershipIds = (data ?? []).map((row) => row.membership_id);
    } else if (filter.type === 'custom' && ids.length) {
      membershipIds = ids;
    }

    let builder = admin
      .from('church_memberships')
      .select('id, phone, users(full_name, email, phone)')
      .eq('church_id', churchId);

    if (membershipIds) builder = builder.in('id', membershipIds);

    const { data, error } = await builder;
    this.supabase.unwrap(data ?? [], error);

    return (data ?? []).map((row: any) => ({
      membershipId: row.id,
      name: row.users?.full_name ?? null,
      phone: row.phone ?? row.users?.phone ?? null,
      email: row.users?.email ?? null,
    }));
  }

  private async dispatchSms(
    churchId: string,
    campaignId: string,
    recipients: Recipient[],
    body: string,
  ) {
    const admin = this.supabase.admin;
    const withPhone = recipients.filter((r) => r.phone);
    if (!withPhone.length) return;

    const rows = withPhone.map((r) => ({
      campaign_id: campaignId,
      church_id: churchId,
      membership_id: r.membershipId,
      channel: 'sms' as const,
      to_address: this.sms.normalizePhone(r.phone as string),
      body,
      status: 'sending' as const,
    }));

    const { data: inserted } = await admin
      .from('messages')
      .insert(rows)
      .select('id, to_address');

    const result: any = await this.sms.send({
      to: withPhone.map((r) => this.sms.normalizePhone(r.phone as string)),
      message: body,
    });

    const atRecipients = result?.SMSMessageData?.Recipients ?? [];
    for (const recipient of atRecipients) {
      const match = inserted?.find((m) => m.to_address === recipient.number);
      if (!match) continue;
      await admin
        .from('messages')
        .update({
          status: recipient.status === 'Success' ? 'sent' : 'failed',
          provider_id: recipient.messageId,
          provider_response: recipient,
          error: recipient.status !== 'Success' ? recipient.status : null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', match.id);
    }
  }

  private async dispatchEmail(
    churchId: string,
    campaignId: string,
    recipients: Recipient[],
    dto: SendMessageDto,
  ) {
    const admin = this.supabase.admin;
    const withEmail = recipients.filter((r) => r.email);
    const subject = dto.subject ?? 'Message from your church';

    for (const recipient of withEmail) {
      const { data: inserted } = await admin
        .from('messages')
        .insert({
          campaign_id: campaignId,
          church_id: churchId,
          membership_id: recipient.membershipId,
          channel: 'email',
          to_address: recipient.email as string,
          body: dto.body,
          status: 'sending',
        })
        .select('id')
        .single();

      try {
        await this.email.send({
          to: recipient.email as string,
          subject,
          html: `<div>${dto.body.replace(/\n/g, '<br />')}</div>`,
        });
        if (inserted) {
          await admin
            .from('messages')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', inserted.id);
        }
      } catch (error) {
        if (inserted) {
          await admin
            .from('messages')
            .update({ status: 'failed', error: (error as Error).message })
            .eq('id', inserted.id);
        }
      }
    }
  }
}