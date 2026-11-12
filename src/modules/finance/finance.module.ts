import { Module } from '@nestjs/common'
import { FinanceController } from './finance.controller'
import { FinanceService } from './finance.service'
import { FinanceGuard } from './finance.guard'

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, FinanceGuard],
  exports: [FinanceService],
})
export class FinanceModule {}
