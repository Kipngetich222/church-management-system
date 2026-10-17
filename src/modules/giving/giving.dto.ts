import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator'
import {
  PHONE_PATTERN,
  PHONE_VALIDATION_MESSAGE,
} from '../../common/phone.config'

export class MpesaStkPushDto {
  @ApiProperty()
  @IsUUID()
  churchId!: string

  @ApiProperty()
  @IsNumber()
  amount!: number

  @ApiProperty()
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_VALIDATION_MESSAGE })
  phone!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string
}
