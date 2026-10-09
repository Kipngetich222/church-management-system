import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChurchAdmin } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { ChurchGuard } from "../../common/guards/church.guard";
import { UseGuards } from "@nestjs/common";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";
import { ChurchesService } from "./churches.service";
import { CreateChurchDto } from "./create-church.dto";
import { QueryChurchesDto } from "./query-churches.dto";
import { UpdateChurchDto } from "./update-church.dto";

@ApiTags("churches")
@Controller("churches")
export class ChurchesController {
  constructor(private readonly churchesService: ChurchesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List / search churches" })
  list(@Query() query: QueryChurchesDto) {
    return this.churchesService.list(query.q);
  }

  @Public()
  @Get("slug/:slug")
  @ApiOperation({ summary: "Get a church by slug" })
  bySlug(@Param("slug") slug: string) {
    return this.churchesService.getBySlug(slug);
  }

  @Public()
  @Get(":churchId")
  @ApiOperation({ summary: "Get a church by id" })
  byId(@Param("churchId") churchId: string) {
    return this.churchesService.getById(churchId);
  }

  @Post()
  @ApiBearerAuth("supabase-jwt")
  @ApiOperation({ summary: "Create a church (onboarding)" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChurchDto) {
    return this.churchesService.create(dto, user);
  }

  @UseGuards(ChurchGuard)
  @ChurchAdmin()
  @Patch(":churchId")
  @ApiBearerAuth("supabase-jwt")
  @ApiOperation({ summary: "Update church settings" })
  update(@Param("churchId") churchId: string, @Body() dto: UpdateChurchDto) {
    return this.churchesService.update(churchId, dto);
  }

  @UseGuards(ChurchGuard)
  @Get(":churchId/stats")
  @ApiBearerAuth("supabase-jwt")
  @ApiOperation({ summary: "Dashboard statistics for a church" })
  stats(@Param("churchId") churchId: string) {
    return this.churchesService.stats(churchId);
  }
}