import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'
import { EmailService } from './email.service'
import { SmsService } from './sms.service'
import { MessagesService } from './messages.service'

describe('In-app notification delivery', () => {
  const churchId = 'church-id'
  const campaignId = 'campaign-id'
  const account = { id: 'membership-id', user_id: 'user-id', status: 'active' }

  function setup(
    recipients: {
      id: string
      user_id: string | null
      status: string | null
    }[] = [account],
    insertError: object | null = null
  ) {
    const campaignUpdates: object[] = []
    const messageInsert = jest
      .fn()
      .mockResolvedValue({ data: null, error: insertError })
    const recipientsQuery: Record<string, jest.Mock> = {}
    for (const method of ['select', 'eq', 'in']) {
      recipientsQuery[method] = jest.fn().mockReturnValue(recipientsQuery)
    }
    recipientsQuery.then = jest.fn((resolve) =>
      resolve({ data: recipients, error: null })
    )
    const from = jest.fn((table: string) => {
      if (table === 'church_memberships') return recipientsQuery
      if (table === 'messages') return { insert: messageInsert }
      if (table === 'message_campaigns')
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: campaignId }, error: null }),
            }),
          }),
          update: (value: object) => {
            campaignUpdates.push(value)
            return { eq: async () => ({ data: null, error: null }) }
          },
        }
      throw new Error(`Unexpected table ${table}`)
    })
    const service = new MessagesService(
      {
        admin: { from },
        unwrap: (data: unknown, error: unknown) => {
          if (error) throw new InternalServerErrorException('Database failed')
          return data
        },
      } as unknown as SupabaseService,
      {} as SmsService,
      {} as EmailService
    )
    return { service, messageInsert, campaignUpdates, recipientsQuery }
  }

  it('persists sent messages for active accounts so the notification trigger can deliver them', async () => {
    const { service, messageInsert, campaignUpdates } = setup([
      account,
      { id: 'manual', user_id: null, status: 'active' },
      { id: 'inactive', user_id: 'inactive-user', status: 'inactive' },
    ])
    await service.send(
      churchId,
      { channel: 'in_app', body: 'Welcome' },
      'admin'
    )
    expect(messageInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        church_id: churchId,
        campaign_id: campaignId,
        membership_id: account.id,
        to_address: account.user_id,
        channel: 'in_app',
        body: 'Welcome',
        status: 'sent',
      }),
    ])
    expect(campaignUpdates).toContainEqual(
      expect.objectContaining({ sent_count: 1 })
    )
  })

  it('does not report successful delivery when message persistence fails', async () => {
    const { service, campaignUpdates } = setup([account], {
      message: 'Database failed',
    })
    await expect(
      service.send(churchId, { channel: 'in_app', body: 'Welcome' }, 'admin')
    ).rejects.toBeInstanceOf(InternalServerErrorException)
    expect(campaignUpdates).not.toContainEqual(
      expect.objectContaining({ status: 'sent' })
    )
  })

  it.each(['custom', 'department', 'group'])(
    'keeps an empty %s audience empty instead of messaging the whole church',
    async (type) => {
      const { service, messageInsert, recipientsQuery } = setup()
      await service.send(
        churchId,
        {
          channel: 'in_app',
          body: 'Private message',
          recipientFilter: { type, ids: [] },
        },
        'admin'
      )
      expect(messageInsert).not.toHaveBeenCalled()
      expect(recipientsQuery.select).not.toHaveBeenCalled()
    }
  )

  it('scopes explicit membership IDs even without a recipient filter', async () => {
    const { service, recipientsQuery } = setup()
    await service.send(
      churchId,
      {
        channel: 'in_app',
        body: 'Private message',
        membershipIds: [account.id],
      },
      'admin'
    )
    expect(recipientsQuery.in).toHaveBeenCalledWith('id', [account.id])
  })

  it('rejects unknown audience types', async () => {
    const { service, messageInsert } = setup()
    await expect(
      service.send(
        churchId,
        {
          channel: 'in_app',
          body: 'Private message',
          recipientFilter: { type: 'unknown' },
        },
        'admin'
      )
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(messageInsert).not.toHaveBeenCalled()
  })
})
