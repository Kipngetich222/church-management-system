import { Module } from '@nestjs/common';
import { ChurchSermonsController, SermonsController } from './sermons.controller';
import { SermonsService } from './sermons.service';

@Module({
  controllers: [ChurchSermonsController, SermonsController],
  providers: [SermonsService],
})
export class SermonsModule {}