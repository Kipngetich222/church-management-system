import {
  Body,
  Controller,
  Delete,
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
import { CurrentMembership } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ChurchGuard } from '../../common/guards/church.guard'
import type { MembershipSummary } from '../../common/interfaces/auth-user.interface'
import {
  CreateVisitorDto,
  FollowUpDto,
  UpdateVisitorDto,
  VisitorWelcomeDto,
} from './visitor.dto'
import { VisitorsService } from './visitors.service'

@ApiTags('visitors')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Roles('super_admin')
@Controller('churches/:churchId/visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get()
  @ApiOperation({ summary: 'List church visitors and comment counts' })
  list(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Headers('authorization') auth: string,
    @Query('status') status?: string
  ) {
    return this.visitorsService.list(churchId, auth, status)
  }

  @Post()
  @ApiOperation({ summary: 'Add a visitor manually' })
  create(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Body() dto: CreateVisitorDto,
    @Headers('authorization') auth: string
  ) {
    return this.visitorsService.create(churchId, dto, auth)
  }

  @Get('qr')
  @ApiOperation({
    summary:
      'View and download the church visitor QR code (null until generated)',
  })
  getQr(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Headers('authorization') auth: string
  ) {
    return this.visitorsService.getQr(churchId, auth)
  }

  @Post('qr')
  @ApiOperation({
    summary:
      'Generate the permanent visitor QR code, or return the existing one',
  })
  ensureQr(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Headers('authorization') auth: string
  ) {
    return this.visitorsService.ensureQr(churchId, auth)
  }

  @Patch('qr')
  @ApiOperation({
    summary: 'Update the welcome message without changing the visitor QR code',
  })
  updateWelcome(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Body() dto: VisitorWelcomeDto,
    @Headers('authorization') auth: string
  ) {
    return this.visitorsService.updateWelcome(
      churchId,
      dto.welcomeMessage,
      auth
    )
  }

  @Get(':visitorId')
  @ApiOperation({ summary: 'Get a visitor with comments and staff follow-ups' })
  getOne(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('visitorId', ParseUUIDPipe) visitorId: string,
    @Headers('authorization') auth: string
  ) {
    return this.visitorsService.getOne(churchId, visitorId, auth)
  }

  @Patch(':visitorId')
  @ApiOperation({ summary: 'Update a visitor' })
  update(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('visitorId', ParseUUIDPipe) visitorId: string,
    @Body() dto: UpdateVisitorDto,
    @Headers('authorization') auth: string
  ) {
    return this.visitorsService.update(churchId, visitorId, dto, auth)
  }

  @Delete(':visitorId')
  @ApiOperation({
    summary: 'Delete a visitor and their comments and follow-ups',
  })
  remove(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('visitorId', ParseUUIDPipe) visitorId: string,
    @Headers('authorization') auth: string
  ) {
    return this.visitorsService.remove(churchId, visitorId, auth)
  }

  @Post(':visitorId/followups')
  @ApiOperation({ summary: 'Add an internal follow-up note' })
  addFollowUp(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('visitorId', ParseUUIDPipe) visitorId: string,
    @CurrentMembership() membership: MembershipSummary,
    @Body() dto: FollowUpDto,
    @Headers('authorization') auth: string
  ) {
    return this.visitorsService.addFollowUp(
      churchId,
      visitorId,
      membership.id,
      dto,
      auth
    )
  }
}
