import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: ["super_admin", "dept_admin", "member"] })
  @IsOptional()
  @IsIn(["super_admin", "dept_admin", "member"])
  role?: "super_admin" | "dept_admin" | "member";

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  badges?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBaptized?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}