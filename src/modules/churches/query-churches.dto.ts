import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class QueryChurchesDto {
  @ApiPropertyOptional({ description: "Free-text search on name" })
  @IsOptional()
  @IsString()
  q?: string;
}