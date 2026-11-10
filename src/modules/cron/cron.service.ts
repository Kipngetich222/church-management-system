import { Injectable } from '@nestjs/common'
import { DeletionService } from '../deletion/deletion.service'
import { MessagesService } from '../messages/messages.service'
import {
  runBirthdayMessages,
  runEventReminderMessages,
} from '../messages/communication-automation'

@Injectable()
export class CronService {
  constructor(
    private readonly messages: MessagesService,
    private readonly deletion: DeletionService
  ) {}
  runBirthdays() {
    return runBirthdayMessages(this.messages.engine)
  }
  runEventReminders() {
    return runEventReminderMessages(this.messages.engine)
  }
  runScheduledMessages() {
    return this.messages.engine.runScheduled()
  }
  async runFinalizeDeletions() {
    const [members, churches] = await Promise.all([
      this.deletion.finalizeMemberDeletions(),
      this.deletion.finalizeChurchDeletions(),
    ])
    return {
      membersFinalized: members.finalized,
      churchesFinalized: churches.finalized,
    }
  }
}
