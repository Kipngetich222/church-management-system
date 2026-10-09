import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChurchAdmin } from "../../common/decorators/roles.decorator";
import { ChurchGuard } from "../../common/guards/church.guard";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@ApiBearerAuth("supabase-jwt")
@UseGuards(ChurchGuard)
@ChurchAdmin()
@Controller("churches/:churchId/audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "List audit logs for a church (admin)" })
  list(@Param("churchId") churchId: string) {
    return this.auditService.list(churchId);
  }
}