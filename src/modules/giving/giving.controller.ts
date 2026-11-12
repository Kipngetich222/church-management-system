import { Readable } from 'node:stream'
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import type { AuthUser } from '../../common/interfaces/auth-user.interface'
import { GivingService } from './giving.service'
import { GivingSettingsDto, MpesaStkPushDto } from './giving.dto'
import { GivingError, type GivingHistoryFilters } from './giving.types'
import { givingCsv } from './giving-csv'

@ApiTags('giving')
@ApiBearerAuth('supabase-jwt')
@Controller('giving')
export class GivingController {
  constructor(private readonly giving: GivingService) {}

  @Post('mpesa')
  @ApiOperation({
    summary: 'Request an STK prompt using the church’s payment setup',
  })
  stkPush(@CurrentUser() user: AuthUser, @Body() dto: MpesaStkPushDto) {
    return this.giving.run((engine) => engine.start(user.id, dto))
  }
  @Get('settings')
  @Header('Cache-Control', 'private, no-store')
  settings(
    @CurrentUser() user: AuthUser,
    @Query('churchId', ParseUUIDPipe) churchId: string
  ) {
    return this.giving.run((engine) => engine.getSettings(user.id, churchId))
  }
  @Put('settings')
  saveSettings(
    @CurrentUser() user: AuthUser,
    @Query('churchId', ParseUUIDPipe) churchId: string,
    @Body() dto: GivingSettingsDto
  ) {
    return this.giving.run((engine) =>
      engine.saveSettings(user.id, churchId, dto)
    )
  }
  @Get('payments/:id')
  @Header('Cache-Control', 'private, no-store')
  payment(
    @CurrentUser() user: AuthUser,
    @Query('churchId', ParseUUIDPipe) churchId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.giving.run((engine) => engine.getPayment(user.id, churchId, id))
  }
  @Post('payments/:id/verify')
  verify(
    @CurrentUser() user: AuthUser,
    @Query('churchId', ParseUUIDPipe) churchId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.giving.run((engine) =>
      engine.verifyPayment(user.id, churchId, id)
    )
  }
  private historyParams(query: Record<string, string>): {
    scope: 'mine' | 'church'
    filters: GivingHistoryFilters
  } {
    const scope = query.scope || 'mine'
    if (scope !== 'mine' && scope !== 'church')
      throw new GivingError('Invalid history scope.')
    return {
      scope,
      filters: {
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
        from: query.from || undefined,
        to: query.to || undefined,
        type: query.type || undefined,
        status: query.status || undefined,
      },
    }
  }
  @Get('history')
  @Header('Cache-Control', 'private, no-store')
  history(
    @CurrentUser() user: AuthUser,
    @Query('churchId', ParseUUIDPipe) churchId: string,
    @Query() query: Record<string, string>
  ) {
    return this.giving.run((engine) => {
      const { scope, filters } = this.historyParams(query)
      return engine.history(user.id, churchId, scope, filters)
    })
  }
  @Get('export')
  @Header('Cache-Control', 'private, no-store')
  export(
    @CurrentUser() user: AuthUser,
    @Query('churchId', ParseUUIDPipe) churchId: string,
    @Query() query: Record<string, string>
  ) {
    return this.giving.run(async (engine) => {
      const { scope, filters } = this.historyParams(query)
      const data = await engine.exportHistory(user.id, churchId, scope, filters)
      return new StreamableFile(
        Readable.from(givingCsv(data.churchName, data.rows)),
        {
          type: 'text/csv; charset=utf-8',
          disposition: `attachment; filename="giving-${churchId}.csv"`,
        }
      )
    })
  }
  @Get('receipts/:id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Get confirmed receipt data for the member or an authorized finance admin',
  })
  receipt(
    @CurrentUser() user: AuthUser,
    @Query('churchId', ParseUUIDPipe) churchId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.giving.run((engine) => engine.receipt(user.id, churchId, id))
  }
  @Public()
  @Post('mpesa/callback')
  callback(
    @Query('id') id: string,
    @Query('token') token: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.giving.run((engine) =>
      engine.handleCallback(id ?? '', token ?? '', body)
    )
  }
}
