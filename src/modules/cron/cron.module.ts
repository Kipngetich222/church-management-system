import { Module } from "@nestjs/common";
import { MessagesModule } from "../messages/messages.module";
import { CronController } from "./cron.controller";
import { CronSecretGuard } from "./cron-secret.guard";
import { CronService } from "./cron.service";

@Module({
  imports: [MessagesModule],
  controllers: [CronController],
  providers: [CronService, CronSecretGuard],
})
export class CronModule {}