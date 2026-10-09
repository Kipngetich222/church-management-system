import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@ChurchAdmin()
@Controller('churches/:churchId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('members')
  @ApiOperation({ summary: 'Member demographics report' })
  members(@Param('churchId') churchId: string) {
    return this.reportsService.membersReport(churchId);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Attendance by event report' })
  attendance(@Param('churchId') churchId: string) {
    return this.reportsService.attendanceReport(churchId);
  }

  @Get('member-growth')
  @ApiOperation({ summary: 'Member growth by month' })
  growth(@Param('churchId') churchId: string) {
    return this.reportsService.memberGrowth(churchId);
  }

  @Get('finance')
  @ApiOperation({ summary: 'Finance report for a date range' })
  finance(
    @Param('churchId') churchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = to ?? new Date().toISOString();
    return this.reportsService.financeReport(churchId, start, end);
  }
}