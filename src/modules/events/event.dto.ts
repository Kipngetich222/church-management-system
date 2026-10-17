import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator'
import {
  PHONE_PATTERN,
  PHONE_VALIDATION_MESSAGE,
} from '../../common/phone.config'

const STATUSES = ['draft', 'published', 'cancelled', 'completed'] as const
const VISIBILITIES = [
  'public',
  'members_only',
  'all_members',
  'super_admins',
  'department',
  'group',
  'men',
  'women',
  'youth',
] as const
const EVENT_TYPES = ['physical', 'online'] as const
const PAYMENT_METHODS = ['free', 'till', 'paybill', 'phone'] as const

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty()
  @IsISO8601()
  startTime!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endTime?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean

  @ApiPropertyOptional({ enum: EVENT_TYPES })
  @IsOptional()
  @IsIn(EVENT_TYPES)
  eventType?: (typeof EVENT_TYPES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meetingLink?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meetingPlatform?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  posterUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capacity?: number

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number]

  @ApiPropertyOptional({ enum: VISIBILITIES })
  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  visibilityDepartmentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  visibilityGroupId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRegistrationRequired?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  registrationDeadline?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentAccount?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentInstructions?: string
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class QueryEventsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number]

  @ApiPropertyOptional({ enum: VISIBILITIES })
  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number]
}

export class RegisterEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string

  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_VALIDATION_MESSAGE })
  phone?: string
}

export class MarkAttendanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  membershipId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationId?: string
}
