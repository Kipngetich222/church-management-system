import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateSermonDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  speaker?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "YouTube video id" })
  @IsString()
  youtubeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  series?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scriptureRef?: string;

  @ApiProperty()
  @IsString()
  preachedAt!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateSermonDto extends PartialType(CreateSermonDto) {}