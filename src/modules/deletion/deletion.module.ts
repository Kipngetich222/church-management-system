import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { MessagesModule } from '../messages/messages.module'
import {
  AccountDeletionController,
  ChurchDeletionController,
} from './deletion.controller'
import { DeletionService } from './deletion.service'

@Module({
  imports: [AuditModule, MessagesModule, MembershipsModule],
  controllers: [AccountDeletionController, ChurchDeletionController],
  providers: [DeletionService],
  exports: [DeletionService],
})
export class DeletionModule {}
