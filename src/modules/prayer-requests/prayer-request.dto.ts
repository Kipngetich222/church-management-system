import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const TYPES = ["prayer", "counseling"] as const;
const VISIBILITIES = [
  "private",
  "pastors_only",
  "public_anonymous",
  "public_named",
] as const;
const STATUSES = ["open", "in_progress", "closed", "answered"] as const;

export class CreatePrayerRequestDto {
  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsIn(TYPES)
  type?: (typeof TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional({ enum: VISIBILITIES })
  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number];
}

export class UpdatePrayerRequestDto extends PartialType(CreatePrayerRequestDto) {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

export class PrayerInteractionDto {
  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  isInternal?: boolean;
}