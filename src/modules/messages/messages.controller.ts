import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentMembership, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import type { AuthUser, MembershipSummary } from '../../common/interfaces/auth-user.interface';
import { SendMessageDto } from './message.dto';
import { MessagesService } from './messages.service';

@ApiTags('communication')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @ChurchAdmin()
  @Get('messages')
  @ApiOperation({ summary: 'List messages sent by the church (admin)' })
  list(@Param('churchId') churchId: string) {
    return this.messagesService.listMessages(churchId);
  }

  @ChurchAdmin()
  @Get('message-campaigns')
  @ApiOperation({ summary: 'List bulk message campaigns (admin)' })
  listCampaigns(@Param('churchId') churchId: string) {
    return this.messagesService.listCampaigns(churchId);
  }

  @Get('messages/me')
  @ApiOperation({ summary: 'Messages addressed to the current member' })
  myMessages(
    @Param('churchId') churchId: string,
    @CurrentMembership() membership: MembershipSummary,
  ) {
    return this.messagesService.listMyMessages(churchId, membership.id);
  }

  @ChurchAdmin()
  @Post('messages/send')
  @ApiOperation({ summary: 'Send an SMS / email campaign (admin)' })
  send(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.send(churchId, dto, user.id);
  }
}