import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateSmallGroupDto {
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
  meetingDay?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meetingTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  leaderMembershipId?: string;
}

export class UpdateSmallGroupDto extends PartialType(CreateSmallGroupDto) {}

export class SmallGroupMemberDto {
  @ApiProperty()
  @IsUUID()
  membershipId!: string;
}