import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

const ROLES = ['super_admin', 'dept_admin', 'member'] as const

export class CreateMemberDto {
  @ApiPropertyOptional({ description: 'Existing user id (preferred)' })
  @IsOptional()
  @IsUUID()
  userId?: string

  @ApiPropertyOptional({
    description: 'Look up the user by email when userId is omitted',
  })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  badges?: string[]

  @ApiPropertyOptional({ description: 'Phone number for SMS contact' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @ApiPropertyOptional({ enum: ['men', 'women', 'youth', 'children'] })
  @IsOptional()
  @IsIn(['men', 'women', 'youth', 'children'])
  category?: 'men' | 'women' | 'youth' | 'children'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateOfBirth?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBaptized?: boolean
}
