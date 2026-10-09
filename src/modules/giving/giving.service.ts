import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../../supabase/supabase.service";
import { MpesaService } from "./mpesa.service";

@Injectable()
export class GivingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mpesa: MpesaService,
    private readonly config: ConfigService,
  ) {}

  async stkPush(
    userId: string,
    input: { churchId: string; amount: number; phone: string; type?: string },
  ) {
    const admin = this.supabase.admin;
    const { data: membership } = await admin
      .from("church_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("church_id", input.churchId)
      .maybeSingle();

    const reference = `MPESA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await this.mpesa.stkPush({
      phone: input.phone,
      amount: input.amount,
      accountReference: reference,
      transactionDesc: "Church giving",
      callbackUrl: `${this.config.get<string>("apiPublicUrl")}/api/v1/giving/mpesa/callback`,
    });

    await admin.from("offerings").insert({
      church_id: input.churchId,
      membership_id: membership?.id ?? null,
      amount: input.amount,
      type: (input.type ?? "general") as any,
      method: "mpesa",
      reference,
      notes: "Awaiting M-Pesa confirmation",
      given_at: new Date().toISOString(),
    });

    return result;
  }

  async handleCallback(body: any) {
    const callback = body?.Body?.stkCallback;
    if (!callback) return { ok: true };

    const admin = this.supabase.admin;
    const reference = callback.CheckoutRequestID as string;

    const { data: offering } = await admin
      .from("offerings")
      .select("id, reference")
      .eq("reference", reference)
      .maybeSingle();

    if (!offering) return { ok: true };

    if (callback.ResultCode === 0) {
      const items = callback.CallbackMetadata?.Item ?? [];
      const receipt = items.find((item: any) => item.Name === "MpesaReceiptNumber")?.Value;
      await admin
        .from("offerings")
        .update({ reference: receipt ?? reference, notes: "M-Pesa confirmed" })
        .eq("id", offering.id);
    } else {
      await admin
        .from("offerings")
        .update({ notes: `M-Pesa failed: ${callback.ResultDesc}` })
        .eq("id", offering.id);
    }

    return { ok: true };
  }
}