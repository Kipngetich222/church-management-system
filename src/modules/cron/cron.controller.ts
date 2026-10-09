import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { CronSecretGuard } from "./cron-secret.guard";
import { CronService } from "./cron.service";

@ApiTags("cron")
@ApiSecurity("cron-secret")
@Public()
@UseGuards(CronSecretGuard)
@Controller("cron")
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Post("birthdays")
  @ApiOperation({ summary: "Send birthday greetings (scheduler only)" })
  birthdays() {
    return this.cronService.runBirthdays();
  }

  @Post("event-reminders")
  @ApiOperation({ summary: "Find events starting in the next 24 hours" })
  eventReminders() {
    return this.cronService.runEventReminders();
  }

  @Post("scheduled-messages")
  @ApiOperation({ summary: "Flag scheduled message campaigns that are due" })
  scheduledMessages() {
    return this.cronService.runScheduledMessages();
  }
}