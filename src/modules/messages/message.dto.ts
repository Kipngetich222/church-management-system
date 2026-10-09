import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

export class SendMessageDto {
  @ApiProperty({ enum: ["sms", "email", "in_app"] })
  @IsIn(["sms", "email", "in_app"])
  channel!: "sms" | "email" | "in_app";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional({
    description: "Recipient filter: { type: 'all' | 'department' | 'group' | 'custom', ids: [] }",
  })
  @IsOptional()
  recipientFilter?: { type?: string; ids?: string[] };

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  membershipIds?: string[];
}