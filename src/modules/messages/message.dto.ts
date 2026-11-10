import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsISO8601,
  IsUUID,
  MaxLength,
  MinLength,
  IsObject,
} from 'class-validator'

export class SendMessageDto {
  @ApiProperty({ enum: ['sms', 'email', 'in_app'] })
  @IsIn(['sms', 'email', 'in_app'])
  channel!: 'sms' | 'email' | 'in_app'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1600)
  body!: string

  @ApiPropertyOptional({
    description:
      "Recipient filter: { type: 'all' | 'department' | 'group' | 'custom' | 'category' | 'leaders', ids: [] }",
  })
  @IsOptional()
  @IsObject()
  recipientFilter?: { type?: string; ids?: string[] }

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  membershipIds?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string

  @ApiPropertyOptional({
    description: 'Reuse this UUID when retrying the same message request.',
  })
  @IsOptional()
  @IsUUID()
  requestId?: string
}
