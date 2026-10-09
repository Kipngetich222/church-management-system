import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentMembership, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import type { AuthUser, MembershipSummary } from '../../common/interfaces/auth-user.interface';
import {
  CreateVolunteerRoleDto,
  CreateVolunteerShiftDto,
  UpdateVolunteerShiftDto,
} from './volunteer.dto';
import { VolunteersService } from './volunteers.service';

@ApiTags('volunteers')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId/volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @Get('roles')
  @ApiOperation({ summary: 'List volunteer roles' })
  listRoles(@Param('churchId') churchId: string) {
    return this.volunteersService.listRoles(churchId);
  }

  @ChurchAdmin()
  @Post('roles')
  @ApiOperation({ summary: 'Create a volunteer role' })
  createRole(@Param('churchId') churchId: string, @Body() dto: CreateVolunteerRoleDto) {
    return this.volunteersService.createRole(churchId, dto);
  }

  @Get('shifts')
  @ApiOperation({ summary: 'List volunteer shifts' })
  listShifts(@Param('churchId') churchId: string) {
    return this.volunteersService.listShifts(churchId);
  }

  @ChurchAdmin()
  @Post('shifts')
  @ApiOperation({ summary: 'Create a volunteer shift' })
  createShift(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVolunteerShiftDto,
  ) {
    return this.volunteersService.createShift(churchId, dto, user.id);
  }

  @ChurchAdmin()
  @Patch('shifts/:shiftId')
  @ApiOperation({ summary: 'Update a volunteer shift' })
  updateShift(
    @Param('churchId') churchId: string,
    @Param('shiftId') shiftId: string,
    @Body() dto: UpdateVolunteerShiftDto,
  ) {
    return this.volunteersService.updateShift(churchId, shiftId, dto);
  }

  @ChurchAdmin()
  @Delete('shifts/:shiftId')
  @ApiOperation({ summary: 'Delete a volunteer shift' })
  removeShift(@Param('churchId') churchId: string, @Param('shiftId') shiftId: string) {
    return this.volunteersService.removeShift(churchId, shiftId);
  }

  @Post('shifts/:shiftId/signup')
  @ApiOperation({ summary: 'Sign up for a volunteer shift' })
  signUp(
    @Param('churchId') churchId: string,
    @Param('shiftId') shiftId: string,
    @CurrentMembership() membership: MembershipSummary,
  ) {
    return this.volunteersService.signUp(churchId, shiftId, membership.id);
  }

  @Delete('shifts/:shiftId/signup')
  @ApiOperation({ summary: 'Cancel a volunteer shift sign-up' })
  cancel(
    @Param('churchId') churchId: string,
    @Param('shiftId') shiftId: string,
    @CurrentMembership() membership: MembershipSummary,
  ) {
    return this.volunteersService.cancelSignUp(churchId, shiftId, membership.id);
  }
}