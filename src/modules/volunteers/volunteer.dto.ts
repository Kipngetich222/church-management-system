import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateVolunteerRoleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateVolunteerShiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsISO8601()
  startsAt!: string;

  @ApiProperty()
  @IsISO8601()
  endsAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  slots?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  eventId?: string;
}

export class UpdateVolunteerShiftDto extends PartialType(CreateVolunteerShiftDto) {}