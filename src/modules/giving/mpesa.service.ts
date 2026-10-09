import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MpesaService {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>("mpesa.env") === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
  }

  private async getAccessToken(): Promise<string> {
    const key = this.config.get<string>("mpesa.consumerKey")!;
    const secret = this.config.get<string>("mpesa.consumerSecret")!;
    const auth = Buffer.from(`${key}:${secret}`).toString("base64");

    const res = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  async stkPush(params: {
    phone: string;
    amount: number;
    accountReference: string;
    transactionDesc: string;
    callbackUrl: string;
  }) {
    const token = await this.getAccessToken();
    const shortcode = this.config.get<string>("mpesa.shortcode")!;
    const passkey = this.config.get<string>("mpesa.passkey")!;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    const res = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(params.amount),
        PartyA: params.phone,
        PartyB: shortcode,
        PhoneNumber: params.phone,
        CallBackURL: params.callbackUrl,
        AccountReference: params.accountReference,
        TransactionDesc: params.transactionDesc,
      }),
    });

    return res.json();
  }
}