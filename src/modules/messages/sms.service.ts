import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SmsService {
  constructor(private readonly config: ConfigService) {}

  private get apiUrl(): string {
    return this.config.get<string>("sms.env") === "production"
      ? "https://api.africastalking.com/version1/messaging"
      : "https://api.sandbox.africastalking.com/version1/messaging";
  }

  async send(params: { to: string[] | string; message: string; senderId?: string }) {
    const username = this.config.get<string>("sms.username")!;
    const apiKey = this.config.get<string>("sms.apiKey")!;
    const from = params.senderId ?? this.config.get<string>("sms.senderId");

    const body = new URLSearchParams();
    body.append("username", username);
    body.append("to", Array.isArray(params.to) ? params.to.join(",") : params.to);
    body.append("message", params.message);
    if (from) body.append("from", from);

    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    return res.json();
  }

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
    if (digits.startsWith("254")) return `+${digits}`;
    if (phone.startsWith("+")) return phone;
    return `+${digits}`;
  }
}