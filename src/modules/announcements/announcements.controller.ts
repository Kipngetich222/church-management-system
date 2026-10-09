import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { ChurchAdmin } from "../../common/decorators/roles.decorator";
import { ChurchGuard } from "../../common/guards/church.guard";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";
import { CreateAnnouncementDto, UpdateAnnouncementDto } from "./announcement.dto";
import { AnnouncementsService } from "./announcements.service";

@ApiTags("announcements")
@Controller("churches/:churchId/announcements")
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List published announcements" })
  list(@Param("churchId") churchId: string) {
    return this.announcementsService.list(churchId, true);
  }

  @ApiBearerAuth("supabase-jwt")
  @UseGuards(ChurchGuard)
  @ChurchAdmin()
  @Get("manage")
  @ApiOperation({ summary: "List all announcements (admin)" })
  listAll(@Param("churchId") churchId: string) {
    return this.announcementsService.list(churchId, false);
  }

  @ApiBearerAuth("supabase-jwt")
  @UseGuards(ChurchGuard)
  @ChurchAdmin()
  @Post()
  @ApiOperation({ summary: "Create an announcement" })
  create(
    @Param("churchId") churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(churchId, dto, user.id);
  }

  @ApiBearerAuth("supabase-jwt")
  @UseGuards(ChurchGuard)
  @ChurchAdmin()
  @Patch(":announcementId")
  @ApiOperation({ summary: "Update an announcement" })
  update(
    @Param("churchId") churchId: string,
    @Param("announcementId") announcementId: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(churchId, announcementId, dto);
  }

  @ApiBearerAuth("supabase-jwt")
  @UseGuards(ChurchGuard)
  @ChurchAdmin()
  @Delete(":announcementId")
  @ApiOperation({ summary: "Delete an announcement" })
  remove(@Param("churchId") churchId: string, @Param("announcementId") announcementId: string) {
    return this.announcementsService.remove(churchId, announcementId);
  }
}