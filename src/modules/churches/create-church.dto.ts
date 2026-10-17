import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator'
import {
  PHONE_PATTERN,
  PHONE_VALIDATION_MESSAGE,
} from '../../common/phone.config'

export class CreateChurchDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

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
  @Matches(PHONE_PATTERN, { message: PHONE_VALIDATION_MESSAGE })
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  website?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string

  @ApiPropertyOptional({ enum: ['starter', 'growth'] })
  @IsOptional()
  @IsIn(['starter', 'growth'])
  plan?: 'starter' | 'growth'
}
