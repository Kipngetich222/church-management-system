import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class CheckEmailDto {
  @ApiProperty({ example: "pastor@church.org" })
  @IsEmail()
  email!: string;
}