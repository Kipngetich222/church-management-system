import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentMembership } from "../../common/decorators/current-user.decorator";
import { ChurchGuard } from "../../common/guards/church.guard";
import type { MembershipSummary } from "../../common/interfaces/auth-user.interface";
import {
  CreatePrayerRequestDto,
  PrayerInteractionDto,
  UpdatePrayerRequestDto,
} from "./prayer-request.dto";
import { PrayerRequestsService } from "./prayer-requests.service";

@ApiTags("prayer-requests")
@ApiBearerAuth("supabase-jwt")
@UseGuards(ChurchGuard)
@Controller("churches/:churchId/prayer-requests")
export class PrayerRequestsController {
  constructor(private readonly prayerRequestsService: PrayerRequestsService) {}

  @Get()
  @ApiOperation({ summary: "List prayer requests visible to the caller" })
  list(
    @Param("churchId") churchId: string,
    @CurrentMembership() membership: MembershipSummary,
    @Query("status") status?: string,
  ) {
    return this.prayerRequestsService.list(churchId, membership, status);
  }

  @Post()
  @ApiOperation({ summary: "Submit a prayer request" })
  create(
    @Param("churchId") churchId: string,
    @CurrentMembership() membership: MembershipSummary,
    @Body() dto: CreatePrayerRequestDto,
  ) {
    return this.prayerRequestsService.create(churchId, membership, dto);
  }

  @Get(":requestId")
  @ApiOperation({ summary: "Get a prayer request" })
  getOne(
    @Param("churchId") churchId: string,
    @Param("requestId") requestId: string,
    @CurrentMembership() membership: MembershipSummary,
  ) {
    return this.prayerRequestsService.getOne(churchId, requestId, membership);
  }

  @Patch(":requestId")
  @ApiOperation({ summary: "Update a prayer request" })
  update(
    @Param("churchId") churchId: string,
    @Param("requestId") requestId: string,
    @CurrentMembership() membership: MembershipSummary,
    @Body() dto: UpdatePrayerRequestDto,
  ) {
    return this.prayerRequestsService.update(churchId, requestId, membership, dto);
  }

  @Post(":requestId/interactions")
  @ApiOperation({ summary: "Add an interaction / note to a prayer request" })
  addInteraction(
    @Param("churchId") churchId: string,
    @Param("requestId") requestId: string,
    @CurrentMembership() membership: MembershipSummary,
    @Body() dto: PrayerInteractionDto,
  ) {
    return this.prayerRequestsService.addInteraction(churchId, requestId, membership, dto);
  }
}