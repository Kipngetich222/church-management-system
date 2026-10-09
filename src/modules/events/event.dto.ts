import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const STATUSES = ["draft", "published", "cancelled", "completed"] as const;
const VISIBILITIES = ["public", "members_only"] as const;

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsISO8601()
  startTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  posterUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ enum: VISIBILITIES })
  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRegistrationRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  registrationDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class QueryEventsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ enum: VISIBILITIES })
  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number];
}

export class RegisterEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class MarkAttendanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  membershipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationId?: string;
}