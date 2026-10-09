import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateMemberDto } from "./create-member.dto";

export class ImportMembersDto {
  @ApiProperty({ type: [CreateMemberDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMemberDto)
  members!: CreateMemberDto[];
}