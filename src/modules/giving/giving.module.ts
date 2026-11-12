import { Module } from '@nestjs/common'
import { GivingController } from './giving.controller'
import { GivingService } from './giving.service'

@Module({
  controllers: [GivingController],
  providers: [GivingService],
  exports: [GivingService],
})
export class GivingModule {}
