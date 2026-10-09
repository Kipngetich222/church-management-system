import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";

export class ScanAttendanceDto {
  @ApiProperty({ description: "Raw QR payload scanned by the client" })
  @IsString()
  payload!: string;

  @ApiPropertyOptional({ description: "Event to check into when scanning a member QR" })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ description: "Membership to check in when scanning a member QR" })
  @IsOptional()
  @IsUUID()
  membershipId?: string;
}