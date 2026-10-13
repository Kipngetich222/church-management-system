import { Module } from '@nestjs/common'
import { DeletionModule } from '../deletion/deletion.module'
import { MessagesModule } from '../messages/messages.module'
import { CronController } from './cron.controller'
import { CronSecretGuard } from './cron-secret.guard'
import { CronService } from './cron.service'

@Module({
  imports: [MessagesModule, DeletionModule],
  controllers: [CronController],
  providers: [CronService, CronSecretGuard],
})
export class CronModule {}
