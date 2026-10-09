import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

const ROLES = ["super_admin", "dept_admin", "member"] as const;

export class CreateMemberDto {
  @ApiPropertyOptional({ description: "Existing user id (preferred)" })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: "Look up the user by email when userId is omitted" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  badges?: string[];
}