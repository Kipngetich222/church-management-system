import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}