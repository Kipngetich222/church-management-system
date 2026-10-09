import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../messages/email.service";
import { ContactDto } from "./contact.dto";

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async submit(dto: ContactDto) {
    const to = this.config.get<string>("email.contactEmail")!;
    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${dto.name}</p>
      <p><strong>Email:</strong> ${dto.email}</p>
      ${dto.church ? `<p><strong>Church:</strong> ${dto.church}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p>${dto.message.replace(/\n/g, "<br />")}</p>
    `;

    try {
      if (this.config.get<string>("email.resendApiKey")) {
        await this.email.send({ to, subject: `New enquiry from ${dto.name}`, html });
      } else {
        this.logger.log(`Contact submission (email not configured): ${JSON.stringify(dto)}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send contact email: ${(error as Error).message}`);
    }

    return { ok: true };
  }
}