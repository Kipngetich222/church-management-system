import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentMembership, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import type { AuthUser, MembershipSummary } from '../../common/interfaces/auth-user.interface';
import {
  CreateCampaignDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateOfferingDto,
  CreatePledgeDto,
  FinanceRangeDto,
} from './finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId/finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('offerings')
  @ChurchAdmin()
  @ApiOperation({ summary: 'List offerings' })
  listOfferings(@Param('churchId') churchId: string, @Query() range: FinanceRangeDto) {
    return this.financeService.listOfferings(churchId, range);
  }

  @Post('offerings')
  @ChurchAdmin()
  @ApiOperation({ summary: 'Record an offering' })
  createOffering(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOfferingDto,
  ) {
    return this.financeService.createOffering(churchId, dto, user.id);
  }

  @Delete('offerings/:offeringId')
  @ChurchAdmin()
  @ApiOperation({ summary: 'Delete an offering' })
  removeOffering(@Param('churchId') churchId: string, @Param('offeringId') offeringId: string) {
    return this.financeService.removeOffering(churchId, offeringId);
  }

  @Get('my-giving')
  @ApiOperation({ summary: "Current member's giving history and pledges" })
  myGiving(
    @Param('churchId') churchId: string,
    @CurrentMembership() membership: MembershipSummary,
  ) {
    return this.financeService.listMyGiving(churchId, membership.id);
  }

  @Get('expenses')
  @ChurchAdmin()
  @ApiOperation({ summary: 'List expenses' })
  listExpenses(@Param('churchId') churchId: string, @Query() range: FinanceRangeDto) {
    return this.financeService.listExpenses(churchId, range);
  }

  @Post('expenses')
  @ChurchAdmin()
  @ApiOperation({ summary: 'Record an expense' })
  createExpense(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.financeService.createExpense(churchId, dto, user.id);
  }

  @Delete('expenses/:expenseId')
  @ChurchAdmin()
  @ApiOperation({ summary: 'Delete an expense' })
  removeExpense(@Param('churchId') churchId: string, @Param('expenseId') expenseId: string) {
    return this.financeService.removeExpense(churchId, expenseId);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List giving campaigns' })
  listCampaigns(@Param('churchId') churchId: string) {
    return this.financeService.listCampaigns(churchId);
  }

  @Post('campaigns')
  @ChurchAdmin()
  @ApiOperation({ summary: 'Create a giving campaign' })
  createCampaign(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.financeService.createCampaign(churchId, dto, user.id);
  }

  @Get('pledges')
  @ChurchAdmin()
  @ApiOperation({ summary: 'List pledges' })
  listPledges(@Param('churchId') churchId: string) {
    return this.financeService.listPledges(churchId);
  }

  @Post('pledges')
  @ChurchAdmin()
  @ApiOperation({ summary: 'Create a pledge' })
  createPledge(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePledgeDto,
  ) {
    return this.financeService.createPledge(churchId, dto, user.id);
  }

  @Get('expense-categories')
  @ApiOperation({ summary: 'List expense categories' })
  listCategories(@Param('churchId') churchId: string) {
    return this.financeService.listExpenseCategories(churchId);
  }

  @Post('expense-categories')
  @ChurchAdmin()
  @ApiOperation({ summary: 'Create an expense category' })
  createCategory(
    @Param('churchId') churchId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.financeService.createExpenseCategory(churchId, dto);
  }

  @Get('summary')
  @ChurchAdmin()
  @ApiOperation({ summary: 'Financial summary for a date range' })
  summary(
    @Param('churchId') churchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = to ?? new Date().toISOString();
    return this.financeService.summary(churchId, start, end);
  }
}