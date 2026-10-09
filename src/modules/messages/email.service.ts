import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: Resend | null = null;

  constructor(private readonly config: ConfigService) {}

  private get resend(): Resend {
    if (!this.client) {
      const apiKey = this.config.get<string>("email.resendApiKey");
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured");
      }
      this.client = new Resend(apiKey);
    }
    return this.client;
  }

  get configured(): boolean {
    return Boolean(this.config.get<string>("email.resendApiKey"));
  }

  async send(params: { to: string | string[]; subject: string; html: string; from?: string }) {
    if (!this.configured) {
      this.logger.warn(
        `RESEND_API_KEY not configured - skipping email to ${Array.isArray(params.to) ? params.to.join(",") : params.to}`,
      );
      return { skipped: true };
    }

    return this.resend.emails.send({
      from: params.from ?? this.config.get<string>("email.from")!,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }
}