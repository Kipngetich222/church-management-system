import { Controller, Delete, Param, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ChurchGuard } from '../../common/guards/church.guard'
import type { AuthUser } from '../../common/interfaces/auth-user.interface'
import { MembershipsService } from './memberships.service'

@ApiTags('memberships')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId/memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Delete('me')
  @ApiOperation({
    summary:
      'Withdraw the current user from this church (transfers super admin or deletes an empty church)',
  })
  withdraw(@Param('churchId') churchId: string, @CurrentUser() user: AuthUser) {
    return this.membershipsService.withdraw(user.id, churchId)
  }
}
