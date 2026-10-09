import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { EmailService } from "../messages/email.service";
import { SmsService } from "../messages/sms.service";

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
  ) {}

  /** Send birthday greetings to members whose birthday is today. */
  async runBirthdays() {
    const admin = this.supabase.admin;
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const { data } = await admin
      .from("church_memberships")
      .select("id, church_id, phone, date_of_birth, users(full_name, email, phone)");

    const todayBirthdays = (data ?? []).filter((row: any) => {
      const dob = row.date_of_birth;
      if (!dob) return false;
      const date = new Date(dob);
      return date.getMonth() + 1 === month && date.getDate() === day;
    });

    let sent = 0;
    for (const member of todayBirthdays as any[]) {
      const phone = member.phone ?? member.users?.phone;
      if (!phone) continue;
      try {
        await this.sms.send({
          to: this.sms.normalizePhone(phone),
          message: `Happy birthday ${member.users?.full_name ?? "friend"}! Blessings from your church family.`,
        });
        sent += 1;
      } catch (error) {
        this.logger.warn(`Birthday SMS failed: ${(error as Error).message}`);
      }
    }

    return { candidates: todayBirthdays.length, sent };
  }

  /** Notify about events starting in the next 24 hours. */
  async runEventReminders() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await this.supabase.admin
      .from("events")
      .select("id, church_id, title, start_time, location_name")
      .eq("status", "published")
      .gte("start_time", now.toISOString())
      .lte("start_time", tomorrow.toISOString());

    const events = this.supabase.unwrap(data ?? [], error);
    return { events, count: events.length };
  }

  /** Flag scheduled message campaigns that are due to be sent. */
  async runScheduledMessages() {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.admin
      .from("message_campaigns")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    const due = this.supabase.unwrap(data ?? [], error);

    if (due.length) {
      await this.supabase.admin
        .from("message_campaigns")
        .update({ status: "sending" })
        .in(
          "id",
          due.map((campaign) => campaign.id),
        );
    }

    return { due: due.length };
  }
}