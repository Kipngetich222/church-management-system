import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";
import { UpdateUserDto } from "./update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth("supabase-jwt")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get the current user profile" })
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getById(user.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update the current user profile" })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }
}