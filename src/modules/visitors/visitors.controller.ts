import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentMembership } from '../../common/decorators/current-user.decorator';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import type { MembershipSummary } from '../../common/interfaces/auth-user.interface';
import { CreateVisitorDto, FollowUpDto, UpdateVisitorDto } from './visitor.dto';
import { VisitorsService } from './visitors.service';

@ApiTags('visitors')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@ChurchAdmin()
@Controller('churches/:churchId/visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get()
  @ApiOperation({ summary: 'List visitors' })
  list(@Param('churchId') churchId: string, @Query('status') status?: string) {
    return this.visitorsService.list(churchId, status);
  }

  @Post()
  @ApiOperation({ summary: 'Record a visitor' })
  create(@Param('churchId') churchId: string, @Body() dto: CreateVisitorDto) {
    return this.visitorsService.create(churchId, dto);
  }

  @Get(':visitorId')
  @ApiOperation({ summary: 'Get a visitor with follow-ups' })
  getOne(@Param('churchId') churchId: string, @Param('visitorId') visitorId: string) {
    return this.visitorsService.getOne(churchId, visitorId);
  }

  @Patch(':visitorId')
  @ApiOperation({ summary: 'Update a visitor' })
  update(
    @Param('churchId') churchId: string,
    @Param('visitorId') visitorId: string,
    @Body() dto: UpdateVisitorDto,
  ) {
    return this.visitorsService.update(churchId, visitorId, dto);
  }

  @Delete(':visitorId')
  @ApiOperation({ summary: 'Delete a visitor' })
  remove(@Param('churchId') churchId: string, @Param('visitorId') visitorId: string) {
    return this.visitorsService.remove(churchId, visitorId);
  }

  @Post(':visitorId/followups')
  @ApiOperation({ summary: 'Add a follow-up note' })
  addFollowUp(
    @Param('churchId') churchId: string,
    @Param('visitorId') visitorId: string,
    @CurrentMembership() membership: MembershipSummary,
    @Body() dto: FollowUpDto,
  ) {
    return this.visitorsService.addFollowUp(churchId, visitorId, membership.id, dto);
  }
}