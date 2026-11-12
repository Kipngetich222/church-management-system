import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator'
import { GIVING_TYPES } from '../giving/giving.types'

const OFFERING_TYPES = GIVING_TYPES

const PAYMENT_METHODS = [
  'cash',
  'mpesa',
  'bank_transfer',
  'cheque',
  'card',
  'online',
  'other',
] as const

export class CreateOfferingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  membershipId?: string

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string

  @ApiPropertyOptional({ enum: OFFERING_TYPES })
  @IsOptional()
  @IsIn(OFFERING_TYPES)
  type?: (typeof OFFERING_TYPES)[number]

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: (typeof PAYMENT_METHODS)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  pledgeId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  givenAt?: string
}

export class CreateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string

  @ApiProperty()
  @IsNumber()
  amount!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  description!: string

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: (typeof PAYMENT_METHODS)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  spentAt?: string
}

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty()
  @IsNumber()
  goalAmount!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string

  @ApiProperty()
  @IsString()
  startDate!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string
}

export class CreatePledgeDto {
  @ApiProperty()
  @IsUUID()
  membershipId!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string

  @ApiProperty()
  @IsNumber()
  amountPledged!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startsOn?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endsOn?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}

export class CreateExpenseCategoryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string
}

export class FinanceRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string
}
