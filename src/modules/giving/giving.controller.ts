import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";
import { GivingService } from "./giving.service";
import { MpesaStkPushDto } from "./giving.dto";

@ApiTags("giving")
@Controller("giving")
export class GivingController {
  constructor(private readonly givingService: GivingService) {}

  @ApiBearerAuth("supabase-jwt")
  @Post("mpesa")
  @ApiOperation({ summary: "Initiate an M-Pesa STK push for giving" })
  stkPush(@CurrentUser() user: AuthUser, @Body() dto: MpesaStkPushDto) {
    return this.givingService.stkPush(user.id, dto);
  }

  @Public()
  @Post("mpesa/callback")
  @ApiOperation({ summary: "M-Pesa STK push callback (webhook)" })
  callback(@Body() body: Record<string, unknown>) {
    return this.givingService.handleCallback(body);
  }
}