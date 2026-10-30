import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'
import { ListNotificationsDto } from './notification.dto'

@Injectable()
export class NotificationsService {
  constructor(private readonly supabase: SupabaseService) {}

  // Using the caller's JWT preserves source audience rules as well as recipient
  // isolation. The service-role client must never read this inbox.
  private client(authorization: string) {
    return this.supabase.forUser(
      authorization.replace(/^Bearer\s+/i, '').trim()
    )
  }

  async list(
    churchId: string,
    authorization: string,
    query: ListNotificationsDto
  ) {
    const { data, error } = await this.client(authorization).rpc(
      'get_notifications',
      {
        p_church_id: churchId,
        p_limit: query.limit,
        p_unread_only: query.unreadOnly,
        ...(query.beforeId
          ? {
              p_before_id: query.beforeId,
              p_before_created_at: query.beforeCreatedAt,
            }
          : {}),
      }
    )
    if (error)
      throw new InternalServerErrorException('Could not load notifications')
    return data
  }

  async setRead(
    churchId: string,
    authorization: string,
    id: string,
    read: boolean
  ) {
    const { data, error } = await this.client(authorization).rpc(
      'set_notification_read',
      {
        p_church_id: churchId,
        p_notification_id: id,
        p_read: read,
      }
    )
    if (error)
      throw new InternalServerErrorException(
        'Could not update the notification'
      )
    if (!data) throw new NotFoundException('Notification not found')
    return { success: true }
  }

  async markAllRead(churchId: string, authorization: string, before: string) {
    const { data, error } = await this.client(authorization).rpc(
      'mark_all_notifications_read',
      {
        p_church_id: churchId,
        p_before: before,
      }
    )
    if (error)
      throw new InternalServerErrorException('Could not update notifications')
    return { updated: data }
  }
}
