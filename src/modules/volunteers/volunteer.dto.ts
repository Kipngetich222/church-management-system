import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateVolunteerRoleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string
}

export class CreateVolunteerShiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleId?: string

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  @Matches(/\S/, { message: 'An activity name is required' })
  title!: string

  @ApiProperty()
  @IsISO8601()
  startsAt!: string

  @ApiProperty()
  @IsISO8601()
  endsAt!: string

  @ApiProperty({ description: 'Venue or meeting point' })
  @IsString()
  @MaxLength(300)
  @Matches(/\S/, { message: 'A venue is required' })
  location!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  slots?: number | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  eventId?: string

  @ApiPropertyOptional({
    enum: ['cleaning', 'compound', 'gardening', 'community', 'other'],
  })
  @IsOptional()
  @IsIn(['cleaning', 'compound', 'gardening', 'community', 'other'])
  category?: string

  @ApiPropertyOptional({ enum: ['none', 'daily', 'weekly', 'monthly'] })
  @IsOptional()
  @IsIn(['none', 'daily', 'weekly', 'monthly'])
  recurrence?: string

  @ApiPropertyOptional({
    description: 'Last recurring session date (YYYY-MM-DD); null means ongoing',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  recurrenceUntil?: string | null

  @ApiPropertyOptional({ default: 'Africa/Nairobi' })
  @IsOptional()
  @IsString()
  timezone?: string

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  // Preserve the JSON boolean: implicit conversion turns the string "false" into true.
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  isActive?: boolean
}

export class UpdateVolunteerShiftDto extends PartialType(
  CreateVolunteerShiftDto
) {}
