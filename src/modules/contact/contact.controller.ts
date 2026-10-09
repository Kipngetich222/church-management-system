import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { ContactDto } from "./contact.dto";
import { ContactService } from "./contact.service";

@ApiTags("contact")
@Controller("contact")
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Submit the public contact form" })
  submit(@Body() dto: ContactDto) {
    return this.contactService.submit(dto);
  }
}