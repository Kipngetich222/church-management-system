import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Readable } from 'node:stream'
import type { Response } from 'express'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ChurchGuard } from '../../common/guards/church.guard'
import type { AuthUser } from '../../common/interfaces/auth-user.interface'
import { FinanceService } from './finance.service'
import { FinanceGuard } from './finance.guard'
import { FinanceRangeDto } from './finance.dto'
import { FinanceError } from './finance.types'
import { financeAuditCsv, financeTransactionsCsv } from './finance-csv'

@ApiTags('finance')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard, FinanceGuard)
@Controller('churches/:churchId/finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('transactions')
  @ApiOperation({
    summary:
      'Paginated finance register with inclusive Nairobi dates and currency filters',
  })
  transactions(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Query() filters: FinanceRangeDto
  ) {
    return this.finance.run((e) => e.history(user.id, church, filters))
  }
  @Get('offerings')
  listOfferings(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Query() filters: FinanceRangeDto
  ) {
    return this.finance.run((e) =>
      e.history(user.id, church, { ...filters, kind: 'giving' })
    )
  }
  @Post('offerings')
  createOffering(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.createEntry(user.id, church, 'giving', input)
    )
  }
  @Get('expenses')
  listExpenses(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Query() filters: FinanceRangeDto
  ) {
    return this.finance.run((e) =>
      e.history(user.id, church, { ...filters, kind: 'expense' })
    )
  }
  @Post('expenses')
  createExpense(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.createEntry(user.id, church, 'expense', input)
    )
  }
  @Post('income')
  createIncome(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.createEntry(user.id, church, 'income', input)
    )
  }
  @Get('entries/:kind/:id')
  entry(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Param('kind') kind: string,
    @Param('id') id: string
  ) {
    return this.finance.run((e) => e.entry(user.id, church, kind, id))
  }
  @Patch('entries/:kind/:id')
  @ApiOperation({
    summary:
      'Void, settle a bill, reconcile or annotate; requires reason and expectedUpdatedAt',
  })
  changeEntry(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.changeEntry(user.id, church, kind, id, input)
    )
  }
  @Delete('offerings/:id')
  removeOffering(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Param('id') id: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.changeEntry(user.id, church, 'giving', id, { ...input, action: 'void' })
    )
  }
  @Delete('expenses/:id')
  removeExpense(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Param('id') id: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.changeEntry(user.id, church, 'expense', id, {
        ...input,
        action: 'void',
      })
    )
  }
  @Get('my-giving')
  myGiving(@CurrentUser() user: AuthUser, @Param('churchId') church: string) {
    return this.finance.run(async (e) => ({
      pledges: await e.pledges(user.id, church, true),
      historyUrl: `/api/v1/giving/history?churchId=${church}&scope=mine`,
    }))
  }
  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Query() filters: FinanceRangeDto
  ) {
    return this.finance.run((e) => e.summary(user.id, church, filters))
  }
  @Get('export')
  @Header('Cache-Control', 'private, no-store')
  async export(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Query() filters: FinanceRangeDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const data = await this.finance.run((e) =>
      e.prepareExport(user.id, church, filters)
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="finance-${church}.csv"`
    )
    return new StreamableFile(
      Readable.from(financeTransactionsCsv(data.church.name, data.rows))
    )
  }
  @Get('audit')
  audit(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Query() filters: FinanceRangeDto
  ) {
    return this.finance.run((e) => e.audit(user.id, church, filters))
  }
  @Get('audit/export')
  @Header('Cache-Control', 'private, no-store')
  async exportAudit(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Query() filters: FinanceRangeDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const rows = await this.finance.run((e) =>
      e.prepareAuditExport(user.id, church, filters)
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="finance-history-${church}.csv"`
    )
    return new StreamableFile(Readable.from(financeAuditCsv(rows)))
  }
  @Get('options')
  options(@CurrentUser() user: AuthUser, @Param('churchId') church: string) {
    return this.finance.run((e) => e.options(user.id, church))
  }
  @Get('expense-categories')
  listCategories(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string
  ) {
    return this.finance.run((e) => e.categories(user.id, church))
  }
  @Post('expense-categories')
  createCategory(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) => e.createCategory(user.id, church, input))
  }
  @Get('campaigns')
  listCampaigns(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string
  ) {
    return this.finance.run((e) => e.campaigns(user.id, church))
  }
  @Post('campaigns')
  createCampaign(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.createPlan(user.id, church, 'campaign', input)
    )
  }
  @Get('pledges')
  listPledges(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string
  ) {
    return this.finance.run((e) => e.pledges(user.id, church))
  }
  @Post('pledges')
  createPledge(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.createPlan(user.id, church, 'pledge', input)
    )
  }
  @Get('budgets')
  listBudgets(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string
  ) {
    return this.finance.run((e) => e.budgets(user.id, church))
  }
  @Post('budgets')
  createBudget(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.createPlan(user.id, church, 'budget', input)
    )
  }
  @Patch('plans/:kind/:id')
  changePlan(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() input: Record<string, unknown>
  ) {
    return this.finance.run((e) =>
      e.changePlan(user.id, church, kind, id, input)
    )
  }
  @Post('entries/:kind/:id/documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10_485_760, files: 1 } })
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @UploadedFile()
    file?: { buffer: Buffer; originalname: string; mimetype: string }
  ) {
    return this.finance.run((e) => {
      if (!file) throw new FinanceError('Choose a supporting document.')
      return e.uploadDocument(user.id, church, kind, id, {
        bytes: file.buffer,
        name: file.originalname,
        type: file.mimetype,
      })
    })
  }
  @Get('documents/:id')
  @Header('Cache-Control', 'private, no-store')
  async document(
    @CurrentUser() user: AuthUser,
    @Param('churchId') church: string,
    @Param('id') id: string
  ) {
    return {
      url: await this.finance.run((e) => e.documentUrl(user.id, church, id)),
      expiresIn: 60,
    }
  }
}
