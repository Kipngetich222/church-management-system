import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
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
  FINANCE_KINDS,
  FINANCE_STATUSES,
  PAYMENT_METHODS,
} from './finance.types'
import { GIVING_TYPES } from '../giving/giving.types'

/** Bodies are validated by FinanceEngine in both clients; this DTO documents query filters. */
export class FinanceRangeDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  from?: string
  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  to?: string
  @ApiPropertyOptional({ example: 'KES' })
  @IsOptional()
  @IsString()
  currency?: string
  @ApiPropertyOptional({ enum: FINANCE_KINDS })
  @IsOptional()
  @IsIn(FINANCE_KINDS)
  kind?: string
  @ApiPropertyOptional({ enum: FINANCE_STATUSES })
  @IsOptional()
  @IsIn(FINANCE_STATUSES)
  status?: string
  @ApiPropertyOptional({ enum: GIVING_TYPES })
  @IsOptional()
  @IsIn(GIVING_TYPES)
  type?: string
  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: string
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() campaignId?: string
  @ApiPropertyOptional({ enum: ['yes', 'no'] })
  @IsOptional()
  @IsIn(['yes', 'no'])
  reconciled?: string
  @ApiPropertyOptional({ enum: ['missing', 'attached'] })
  @IsOptional()
  @IsIn(['missing', 'attached'])
  documents?: string
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number
}
