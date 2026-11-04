import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsEmail,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'
import {
  PHONE_PATTERN,
  PHONE_VALIDATION_MESSAGE,
} from '../../common/phone.config'

export class CreateVisitorDto {
  @ApiProperty()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
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
  @MaxLength(254)
  email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  firstVisitDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  invitedByMembershipId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['new', 'contacted', 'follow_up', 'converted', 'cold'])
  status?: string
}

export class UpdateVisitorDto extends PartialType(CreateVisitorDto) {}

export class FollowUpDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['call', 'sms', 'email', 'visit', 'in_person'])
  method?: string

  @ApiProperty()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(5000)
  notes!: string
}

export class VisitorWelcomeDto {
  @ApiProperty()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(2000)
  welcomeMessage!: string
}

export class RegisterVisitorDto extends PickType(CreateVisitorDto, [
  'fullName',
  'phone',
  'email',
] as const) {
  @ApiProperty({
    description:
      'Random 32-byte hexadecimal token. Reuse it when retrying registration and send it in X-Visitor-Session for subsequent access.',
  })
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  sessionToken!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string
}

export class VisitorCommentDto {
  @ApiProperty()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(2000)
  body!: string

  @ApiProperty({
    description: 'A unique UUID for this comment; reuse when retrying.',
  })
  @IsUUID()
  submissionId!: string
}
