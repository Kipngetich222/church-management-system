import { Module } from '@nestjs/common'
import { VolunteersController } from './volunteers.controller'
import { VolunteersService } from './volunteers.service'
import { VolunteersGuard } from './volunteers.guard'

@Module({
  controllers: [VolunteersController],
  providers: [VolunteersService, VolunteersGuard],
})
export class VolunteersModule {}
