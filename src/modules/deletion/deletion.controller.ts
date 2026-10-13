import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ChurchGuard } from '../../common/guards/church.guard'
import type { AuthUser } from '../../common/interfaces/auth-user.interface'
import { DeletionService } from './deletion.service'

@ApiTags('account')
@ApiBearerAuth('supabase-jwt')
@Controller('account/deletion')
export class AccountDeletionController {
  constructor(private readonly deletion: DeletionService) {}

  @Get()
  @ApiOperation({ summary: "Current user's pending account deletion request" })
  status(@CurrentUser() user: AuthUser) {
    return this.deletion.getMemberRequest(user.id)
  }

  @Post()
  @ApiOperation({
    summary:
      'Request deletion of the current account (10 minute revert window)',
  })
  request(@CurrentUser() user: AuthUser, @Body('reason') reason?: string) {
    return this.deletion.requestMemberDeletion(user.id, reason)
  }

  @Delete()
  @ApiOperation({ summary: 'Revert the pending account deletion request' })
  revert(@CurrentUser() user: AuthUser) {
    return this.deletion.revertMemberDeletion(user.id)
  }
}

@ApiTags('churches')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Roles('super_admin')
@Controller('churches/:churchId/deletion')
export class ChurchDeletionController {
  constructor(private readonly deletion: DeletionService) {}

  @Get()
  @ApiOperation({
    summary: 'Current church deletion request and super admin approvals',
  })
  status(@Param('churchId') churchId: string) {
    return this.deletion.getChurchStatus(churchId)
  }

  @Post()
  @ApiOperation({
    summary: 'Start church deletion (all super admins must accept)',
  })
  initiate(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body('reason') reason?: string
  ) {
    return this.deletion.initiateChurchDeletion(churchId, user.id, reason)
  }

  @Post('decision')
  @ApiOperation({
    summary: 'Accept or reject the church deletion as a super admin',
  })
  decide(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body('decision') decision: string
  ) {
    if (decision !== 'approve' && decision !== 'reject') {
      throw new BadRequestException('decision must be approve or reject')
    }
    return this.deletion.decideChurchDeletion(churchId, user.id, decision)
  }

  @Delete()
  @ApiOperation({
    summary: 'Revert the church deletion during the grace period',
  })
  revert(@Param('churchId') churchId: string, @CurrentUser() user: AuthUser) {
    return this.deletion.revertChurchDeletion(churchId, user.id)
  }
}
