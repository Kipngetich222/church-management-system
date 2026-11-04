import { Module } from '@nestjs/common'
import { VisitorsController } from './visitors.controller'
import { VisitorsService } from './visitors.service'
import { VisitorWelcomeController } from './visitor-welcome.controller'

@Module({
  controllers: [VisitorsController, VisitorWelcomeController],
  providers: [VisitorsService],
})
export class VisitorsModule {}
