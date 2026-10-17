import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'
import {
  PHONE_PATTERN,
  PHONE_VALIDATION_MESSAGE,
} from '../../common/phone.config'

export class UpdateMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ enum: ['men', 'women', 'youth', 'children'] })
  @IsOptional()
  @IsIn(['men', 'women', 'youth', 'children'])
  category?: 'men' | 'women' | 'youth' | 'children'

  @ApiPropertyOptional({ enum: ['super_admin', 'dept_admin', 'member'] })
  @IsOptional()
  @IsIn(['super_admin', 'dept_admin', 'member'])
  role?: 'super_admin' | 'dept_admin' | 'member'

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  badges?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBaptized?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateOfBirth?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_VALIDATION_MESSAGE })
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}
