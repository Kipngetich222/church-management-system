import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ChurchGuard } from '../../common/guards/church.guard'
import {
  ListNotificationsDto,
  MarkAllNotificationsReadDto,
  SetNotificationReadDto,
} from './notification.dto'
import { NotificationsService } from './notifications.service'

@ApiTags('notifications')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Current user’s notifications and unread count in this church',
  })
  list(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Headers('authorization') authorization: string,
    @Query() query: ListNotificationsDto
  ) {
    return this.notifications.list(churchId, authorization, query)
  }

  @Patch(':notificationId')
  @ApiOperation({ summary: 'Mark an owned notification as read or unread' })
  setRead(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Headers('authorization') authorization: string,
    @Body() body: SetNotificationReadDto
  ) {
    return this.notifications.setRead(
      churchId,
      authorization,
      notificationId,
      body.read
    )
  }

  @Post('read-all')
  @ApiOperation({
    summary: 'Mark current notifications as read, preserving newer arrivals',
  })
  markAllRead(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Headers('authorization') authorization: string,
    @Body() body: MarkAllNotificationsReadDto
  ) {
    return this.notifications.markAllRead(churchId, authorization, body.before)
  }
}
