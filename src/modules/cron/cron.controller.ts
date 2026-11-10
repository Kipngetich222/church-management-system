import { Controller, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { CronSecretGuard } from './cron-secret.guard'
import { CronService } from './cron.service'

@ApiTags('cron')
@ApiSecurity('cron-secret')
@Public()
@UseGuards(CronSecretGuard)
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Post('birthdays')
  @ApiOperation({ summary: 'Send birthday greetings (scheduler only)' })
  birthdays() {
    return this.cronService.runBirthdays()
  }

  @Post('event-reminders')
  @ApiOperation({
    summary: 'Send audited reminders for events starting in the next 24 hours',
  })
  eventReminders() {
    return this.cronService.runEventReminders()
  }

  @Post('scheduled-messages')
  @ApiOperation({
    summary:
      'Dispatch due message campaigns using the shared church SMS balance',
  })
  scheduledMessages() {
    return this.cronService.runScheduledMessages()
  }

  @Post('finalize-deletions')
  @ApiOperation({ summary: 'Permanently apply due member / church deletions' })
  finalizeDeletions() {
    return this.cronService.runFinalizeDeletions()
  }
}
