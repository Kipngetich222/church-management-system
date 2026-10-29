import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'

export class CreateResourceDto {
  @ApiProperty()
  @IsString()
  @Matches(/\S/, { message: 'A resource title is required' })
  @MaxLength(160)
  name!: string

  @ApiProperty({ enum: ['document', 'book', 'image'] })
  @IsIn(['document', 'book', 'image'])
  type!: 'document' | 'book' | 'image'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @ApiPropertyOptional({ description: 'Event or album name for photos' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  eventName?: string

  @ApiPropertyOptional({ example: '2026-10-29' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  photoDate?: string
}

export class UpdateResourceDto extends PartialType(CreateResourceDto) {}
