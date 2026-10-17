import { ApiPropertyOptional } from '@nestjs/swagger'
import {
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

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_VALIDATION_MESSAGE })
  @MaxLength(40)
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string
}
