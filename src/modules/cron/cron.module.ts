import { Module } from '@nestjs/common'
import { DeletionModule } from '../deletion/deletion.module'
import { MessagesModule } from '../messages/messages.module'
import { GivingModule } from '../giving/giving.module'
import { CronController } from './cron.controller'
import { CronSecretGuard } from './cron-secret.guard'
import { CronService } from './cron.service'

@Module({
  imports: [MessagesModule, DeletionModule, GivingModule],
  controllers: [CronController],
  providers: [CronService, CronSecretGuard],
})
export class CronModule {}
