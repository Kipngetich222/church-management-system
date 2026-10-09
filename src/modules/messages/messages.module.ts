import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { SmsService } from './sms.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, SmsService, EmailService],
  exports: [SmsService, EmailService],
})
export class MessagesModule {}