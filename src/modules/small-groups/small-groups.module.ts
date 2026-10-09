import { Module } from '@nestjs/common';
import { SmallGroupsController } from './small-groups.controller';
import { SmallGroupsService } from './small-groups.service';

@Module({
  controllers: [SmallGroupsController],
  providers: [SmallGroupsService],
})
export class SmallGroupsModule {}