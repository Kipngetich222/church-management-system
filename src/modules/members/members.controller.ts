import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentMembership } from "../../common/decorators/current-user.decorator";
import { ChurchAdmin } from "../../common/decorators/roles.decorator";
import { ChurchGuard } from "../../common/guards/church.guard";
import type { MembershipSummary } from "../../common/interfaces/auth-user.interface";
import { CreateMemberDto } from "./create-member.dto";
import { ImportMembersDto } from "./import-members.dto";
import { MembersService } from "./members.service";
import { UpdateMemberDto } from "./update-member.dto";

@ApiTags("members")
@ApiBearerAuth("supabase-jwt")
@UseGuards(ChurchGuard)
@Controller("churches/:churchId/members")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: "List church members" })
  list(@Param("churchId") churchId: string) {
    return this.membersService.list(churchId);
  }

  @Get("me")
  @ApiOperation({ summary: "Current user's membership in this church" })
  me(@CurrentMembership() membership: MembershipSummary) {
    return membership;
  }

  @ChurchAdmin()
  @Post()
  @ApiOperation({ summary: "Add a member to the church" })
  create(@Param("churchId") churchId: string, @Body() dto: CreateMemberDto) {
    return this.membersService.create(churchId, dto);
  }

  @ChurchAdmin()
  @Post("import")
  @ApiOperation({ summary: "Bulk import members" })
  import(@Param("churchId") churchId: string, @Body() dto: ImportMembersDto) {
    return this.membersService.import(churchId, dto.members);
  }

  @Get(":membershipId")
  @ApiOperation({ summary: "Get a single membership" })
  getOne(
    @Param("churchId") churchId: string,
    @Param("membershipId") membershipId: string,
  ) {
    return this.membersService.getOne(churchId, membershipId);
  }

  @ChurchAdmin()
  @Patch(":membershipId")
  @ApiOperation({ summary: "Update a membership" })
  update(
    @Param("churchId") churchId: string,
    @Param("membershipId") membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(churchId, membershipId, dto);
  }

  @ChurchAdmin()
  @Delete(":membershipId")
  @ApiOperation({ summary: "Remove a member from the church" })
  remove(
    @Param("churchId") churchId: string,
    @Param("membershipId") membershipId: string,
  ) {
    return this.membersService.remove(churchId, membershipId);
  }
}