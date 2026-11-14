import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import {
  DESTINATION_TYPES,
  GIVING_TYPES,
  MAX_GIVING_AMOUNT,
  type DestinationType,
  type GivingType,
} from './giving.types'

export class MpesaStkPushDto {
  @ApiProperty() @IsUUID() churchId!: string
  @ApiProperty({
    description:
      'A client-generated UUID, reused when retrying the same request',
  })
  @IsUUID()
  requestId!: string
  @ApiProperty({ minimum: 1, maximum: MAX_GIVING_AMOUNT })
  @IsInt()
  @Min(1)
  @Max(MAX_GIVING_AMOUNT)
  amount!: number
  @ApiProperty() @IsString() @MaxLength(30) phone!: string
  @ApiProperty({ enum: GIVING_TYPES }) @IsIn(GIVING_TYPES) type!: GivingType
  @ApiPropertyOptional() @IsOptional() @IsUUID() campaignId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() pledgeId?: string
}
export class GivingSettingsDto {
  @ApiProperty() @IsBoolean() enabled!: boolean
  @ApiProperty({ enum: DESTINATION_TYPES })
  @IsIn(DESTINATION_TYPES)
  destinationType!: DestinationType
  @ApiProperty() @IsString() @MaxLength(30) destinationNumber!: string
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(12)
  accountReference = ''
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(7)
  businessShortCode = ''
  @ApiProperty({ enum: ['sandbox', 'production'] })
  @IsIn(['sandbox', 'production'])
  environment!: 'sandbox' | 'production'
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  consumerKey?: string
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  consumerSecret?: string
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  passkey?: string
}
