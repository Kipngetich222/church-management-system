import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { MessagesModule } from '../messages/messages.module'
import { MembershipsController } from './memberships.controller'
import { MembershipsService } from './memberships.service'

@Module({
  imports: [AuditModule, MessagesModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
