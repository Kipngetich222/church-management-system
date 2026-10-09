import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentMembership } from "../../common/decorators/current-user.decorator";
import { ChurchGuard } from "../../common/guards/church.guard";
import type { MembershipSummary } from "../../common/interfaces/auth-user.interface";
import { AttendanceService } from "./attendance.service";
import { ScanAttendanceDto } from "./attendance.dto";

@ApiTags("attendance")
@ApiBearerAuth("supabase-jwt")
@UseGuards(ChurchGuard)
@Controller("churches/:churchId/attendance")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get("me/qr")
  @ApiOperation({ summary: "Generate the current member's check-in QR code" })
  myQr(
    @Param("churchId") churchId: string,
    @CurrentMembership() membership: MembershipSummary,
  ) {
    return this.attendanceService.memberQr(churchId, membership.id);
  }

  @Post("scan")
  @ApiOperation({ summary: "Scan a QR code to check in" })
  scan(
    @Param("churchId") churchId: string,
    @CurrentMembership() membership: MembershipSummary,
    @Body() dto: ScanAttendanceDto,
  ) {
    return this.attendanceService.scan(churchId, membership.id, dto);
  }
}