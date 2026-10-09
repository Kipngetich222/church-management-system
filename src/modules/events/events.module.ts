import { Module } from '@nestjs/common';
import { ChurchEventsController, EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [ChurchEventsController, EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}