import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import {
  CreateSmallGroupDto,
  SmallGroupMemberDto,
  UpdateSmallGroupDto,
} from './small-group.dto';
import { SmallGroupsService } from './small-groups.service';

@ApiTags('small-groups')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId/small-groups')
export class SmallGroupsController {
  constructor(private readonly smallGroupsService: SmallGroupsService) {}

  @Get()
  @ApiOperation({ summary: 'List small groups' })
  list(@Param('churchId') churchId: string) {
    return this.smallGroupsService.list(churchId);
  }

  @ChurchAdmin()
  @Post()
  @ApiOperation({ summary: 'Create a small group' })
  create(@Param('churchId') churchId: string, @Body() dto: CreateSmallGroupDto) {
    return this.smallGroupsService.create(churchId, dto);
  }

  @ChurchAdmin()
  @Patch(':groupId')
  @ApiOperation({ summary: 'Update a small group' })
  update(
    @Param('churchId') churchId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateSmallGroupDto,
  ) {
    return this.smallGroupsService.update(churchId, groupId, dto);
  }

  @ChurchAdmin()
  @Delete(':groupId')
  @ApiOperation({ summary: 'Delete a small group' })
  remove(@Param('churchId') churchId: string, @Param('groupId') groupId: string) {
    return this.smallGroupsService.remove(churchId, groupId);
  }

  @ChurchAdmin()
  @Post(':groupId/members')
  @ApiOperation({ summary: 'Add a member to a small group' })
  addMember(
    @Param('churchId') churchId: string,
    @Param('groupId') groupId: string,
    @Body() dto: SmallGroupMemberDto,
  ) {
    return this.smallGroupsService.addMember(churchId, groupId, dto.membershipId);
  }

  @ChurchAdmin()
  @Delete(':groupId/members/:membershipId')
  @ApiOperation({ summary: 'Remove a member from a small group' })
  removeMember(
    @Param('churchId') churchId: string,
    @Param('groupId') groupId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.smallGroupsService.removeMember(churchId, groupId, membershipId);
  }
}