import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "#6366f1" })
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class DepartmentMemberDto {
  @ApiProperty()
  @IsUUID()
  membershipId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLeader?: boolean;
}