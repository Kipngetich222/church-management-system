import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChurchAdmin } from "../../common/decorators/roles.decorator";
import { ChurchGuard } from "../../common/guards/church.guard";
import { CreateDepartmentDto, DepartmentMemberDto, UpdateDepartmentDto } from "./department.dto";
import { DepartmentsService } from "./departments.service";

@ApiTags("departments")
@ApiBearerAuth("supabase-jwt")
@UseGuards(ChurchGuard)
@Controller("churches/:churchId/departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: "List departments" })
  list(@Param("churchId") churchId: string) {
    return this.departmentsService.list(churchId);
  }

  @ChurchAdmin()
  @Post()
  @ApiOperation({ summary: "Create a department" })
  create(@Param("churchId") churchId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(churchId, dto);
  }

  @ChurchAdmin()
  @Patch(":departmentId")
  @ApiOperation({ summary: "Update a department" })
  update(
    @Param("churchId") churchId: string,
    @Param("departmentId") departmentId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(churchId, departmentId, dto);
  }

  @ChurchAdmin()
  @Delete(":departmentId")
  @ApiOperation({ summary: "Delete a department" })
  remove(@Param("churchId") churchId: string, @Param("departmentId") departmentId: string) {
    return this.departmentsService.remove(churchId, departmentId);
  }

  @ChurchAdmin()
  @Post(":departmentId/members")
  @ApiOperation({ summary: "Add a member to a department" })
  addMember(
    @Param("churchId") churchId: string,
    @Param("departmentId") departmentId: string,
    @Body() dto: DepartmentMemberDto,
  ) {
    return this.departmentsService.addMember(churchId, departmentId, dto.membershipId, dto.isLeader);
  }

  @ChurchAdmin()
  @Post(":departmentId/promote")
  @ApiOperation({ summary: "Promote a member to department leader" })
  promote(
    @Param("churchId") churchId: string,
    @Param("departmentId") departmentId: string,
    @Body() dto: DepartmentMemberDto,
  ) {
    return this.departmentsService.promote(churchId, departmentId, dto.membershipId);
  }

  @ChurchAdmin()
  @Delete(":departmentId/members/:membershipId")
  @ApiOperation({ summary: "Remove a member from a department" })
  removeMember(
    @Param("churchId") churchId: string,
    @Param("departmentId") departmentId: string,
    @Param("membershipId") membershipId: string,
  ) {
    return this.departmentsService.removeMember(churchId, departmentId, membershipId);
  }
}