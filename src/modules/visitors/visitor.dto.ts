import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsEmail,
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

export class CreateVisitorDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  fullName!: string

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
  @IsString()
  firstVisitDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  invitedByMembershipId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string
}

export class UpdateVisitorDto extends PartialType(CreateVisitorDto) {}

export class FollowUpDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  method?: string

  @ApiProperty()
  @IsString()
  notes!: string
}
