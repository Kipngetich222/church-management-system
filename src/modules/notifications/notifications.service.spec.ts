import { InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { SupabaseService } from '../../supabase/supabase.service'
import {
  ListNotificationsDto,
  SetNotificationReadDto,
} from './notification.dto'
import { NotificationsService } from './notifications.service'

describe('Notifications API', () => {
  const churchId = '00000000-0000-4000-8000-000000000100'
  const notificationId = '00000000-0000-4000-8000-000000000200'
  const snapshot = '2026-10-30T10:00:00.123456Z'
  let rpc: jest.Mock
  let forUser: jest.Mock
  let service: NotificationsService

  beforeEach(() => {
    rpc = jest.fn().mockResolvedValue({ data: true, error: null })
    forUser = jest.fn().mockReturnValue({ rpc })
    service = new NotificationsService({
      forUser,
    } as unknown as SupabaseService)
  })

  it('uses the caller’s JWT for inbox reads so database audience and recipient policies remain active', async () => {
    const result = {
      items: [],
      unread_count: 0,
      has_more: false,
      snapshot_at: snapshot,
    }
    rpc.mockResolvedValue({ data: result, error: null })
    await expect(
      service.list(
        churchId,
        'Bearer user-access-token',
        new ListNotificationsDto()
      )
    ).resolves.toEqual(result)
    expect(forUser).toHaveBeenCalledWith('user-access-token')
    expect(rpc).toHaveBeenCalledWith(
      'get_notifications',
      expect.objectContaining({ p_church_id: churchId })
    )
  })

  it('returns not-found when an update targets a notification hidden by RLS', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await expect(
      service.setRead(churchId, 'Bearer member-token', notificationId, true)
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('passes the server snapshot to bulk marking without advancing it to the action time', async () => {
    rpc.mockResolvedValue({ data: 7, error: null })
    await expect(
      service.markAllRead(churchId, 'Bearer member-token', snapshot)
    ).resolves.toEqual({ updated: 7 })
    expect(rpc).toHaveBeenCalledWith('mark_all_notifications_read', {
      p_church_id: churchId,
      p_before: snapshot,
    })
  })

  it('does not turn a database failure into an empty inbox or expose database internals', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'private database detail' },
    })
    await expect(
      service.list(churchId, 'Bearer member-token', new ListNotificationsDto())
    ).rejects.toThrow(
      new InternalServerErrorException('Could not load notifications')
    )
  })

  it('parses an explicit false filter correctly and rejects invalid filters, limits and partial cursors', async () => {
    const valid = plainToInstance(ListNotificationsDto, {
      unreadOnly: 'false',
      limit: '5',
    })
    expect(valid.unreadOnly).toBe(false)
    expect(valid.limit).toBe(5)
    expect(await validate(valid)).toHaveLength(0)
    for (const query of [
      { unreadOnly: 'anything' },
      { limit: '0' },
      { limit: '51' },
      { limit: '2.5' },
      { beforeId: notificationId },
      { beforeCreatedAt: snapshot },
      { beforeId: 'invalid', beforeCreatedAt: snapshot },
    ]) {
      expect(
        (await validate(plainToInstance(ListNotificationsDto, query))).length
      ).toBeGreaterThan(0)
    }
    expect(
      await validate(
        plainToInstance(ListNotificationsDto, {
          beforeId: notificationId,
          beforeCreatedAt: snapshot,
          unreadOnly: 'true',
        })
      )
    ).toHaveLength(0)
  })

  it('requires a boolean read state instead of treating strings or missing values as read', async () => {
    for (const body of [{}, { read: null }, { read: 'false' }]) {
      expect(
        (await validate(plainToInstance(SetNotificationReadDto, body))).length
      ).toBeGreaterThan(0)
    }
    expect(
      await validate(plainToInstance(SetNotificationReadDto, { read: false }))
    ).toHaveLength(0)
  })
})
