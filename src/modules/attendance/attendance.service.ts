import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { buildMemberQrPayload, generateQrDataUrl, parseQrPayload } from "../../common/utils/qr";
import { ScanAttendanceDto } from "./attendance.dto";

@Injectable()
export class AttendanceService {
  constructor(private readonly supabase: SupabaseService) {}

  async memberQr(churchId: string, membershipId: string) {
    const payload = buildMemberQrPayload(membershipId, churchId);
    const dataUrl = await generateQrDataUrl(payload);
    return { payload, dataUrl };
  }

  async scan(churchId: string, membershipId: string, dto: ScanAttendanceDto) {
    const payload = parseQrPayload(dto.payload);
    if (!payload) throw new BadRequestException("Invalid QR payload");

    const type = payload.t as string;

    if (type === "event") {
      const eventId = payload.e as string;
      if (payload.c !== churchId) {
        throw new BadRequestException("This QR code belongs to another church");
      }
      return this.checkIn(eventId, membershipId, "qr");
    }

    if (type === "member") {
      if (payload.c !== churchId) {
        throw new BadRequestException("This QR code belongs to another church");
      }
      const targetMembership = (payload.m as string) || dto.membershipId;
      if (!dto.eventId) {
        throw new BadRequestException("eventId is required when scanning a member QR");
      }
      if (!targetMembership) {
        throw new BadRequestException("No membership found in the scanned member QR");
      }
      return this.checkIn(dto.eventId, targetMembership, "qr");
    }

    throw new BadRequestException("Unsupported QR payload");
  }

  private async checkIn(eventId: string, membershipId: string, method: string) {
    const admin = this.supabase.admin;

    const { data: event } = await admin
      .from("events")
      .select("id, church_id")
      .eq("id", eventId)
      .maybeSingle();
    if (!event) throw new NotFoundException("Event not found");

    const { data: existing } = await admin
      .from("event_attendance")
      .select("id, scanned_at")
      .eq("event_id", eventId)
      .eq("membership_id", membershipId)
      .maybeSingle();

    if (existing) {
      return { alreadyCheckedIn: true, attendance: existing };
    }

    const { data, error } = await admin
      .from("event_attendance")
      .insert({ event_id: eventId, membership_id: membershipId, method })
      .select()
      .single();

    return { alreadyCheckedIn: false, attendance: this.supabase.unwrap(data, error) };
  }
}