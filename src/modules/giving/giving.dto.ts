import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class MpesaStkPushDto {
  @ApiProperty()
  @IsUUID()
  churchId!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}