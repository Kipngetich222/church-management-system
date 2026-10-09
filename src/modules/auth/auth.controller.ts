import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";
import { AuthService } from "./auth.service";
import { CheckEmailDto } from "./check-email.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("check-email")
  @HttpCode(200)
  @ApiOperation({ summary: "Check whether an email already has an account" })
  async checkEmail(@Body() dto: CheckEmailDto) {
    return { exists: await this.authService.emailExists(dto.email) };
  }

  @Get("me")
  @ApiBearerAuth("supabase-jwt")
  @ApiOperation({ summary: "Return the current user with their church memberships" })
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.id);
  }
}