import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateResourceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateResourceDto extends PartialType(CreateResourceDto) {}

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  resourceId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty()
  @IsISO8601()
  startsAt!: string;

  @ApiProperty()
  @IsISO8601()
  endsAt!: string;
}