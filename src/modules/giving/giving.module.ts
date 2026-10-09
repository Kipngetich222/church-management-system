import { Module } from "@nestjs/common";
import { GivingController } from "./giving.controller";
import { GivingService } from "./giving.service";
import { MpesaService } from "./mpesa.service";

@Module({
  controllers: [GivingController],
  providers: [GivingService, MpesaService],
})
export class GivingModule {}