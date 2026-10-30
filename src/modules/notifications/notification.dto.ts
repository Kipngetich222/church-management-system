import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator'

export class ListNotificationsDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value
  )
  @IsBoolean()
  unreadOnly = false

  @ApiPropertyOptional({
    description: 'created_at of the last item; supply with beforeId',
  })
  @ValidateIf(
    (value: ListNotificationsDto) =>
      value.beforeCreatedAt !== undefined || value.beforeId !== undefined
  )
  @IsISO8601({ strict: true })
  beforeCreatedAt?: string

  @ApiPropertyOptional({
    description: 'id of the last item; supply with beforeCreatedAt',
  })
  @ValidateIf(
    (value: ListNotificationsDto) =>
      value.beforeCreatedAt !== undefined || value.beforeId !== undefined
  )
  @IsUUID()
  beforeId?: string
}

export class SetNotificationReadDto {
  @ApiProperty({ description: 'true to mark as read; false to mark as unread' })
  @IsBoolean()
  read!: boolean
}

export class MarkAllNotificationsReadDto {
  @ApiProperty({
    description:
      'snapshot_at from the inbox response; newer arrivals remain unread',
  })
  @IsISO8601({ strict: true })
  before!: string
}
