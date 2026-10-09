import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import type { MembershipSummary } from "../../common/interfaces/auth-user.interface";
import {
  CreatePrayerRequestDto,
  PrayerInteractionDto,
  UpdatePrayerRequestDto,
} from "./prayer-request.dto";

@Injectable()
export class PrayerRequestsService {
  constructor(private readonly supabase: SupabaseService) {}

  private isAdmin(membership: MembershipSummary) {
    return membership.role === "super_admin" || membership.role === "dept_admin";
  }

  async list(churchId: string, membership: MembershipSummary, status?: string) {
    let builder = this.supabase.admin
      .from("prayer_requests")
      .select("*, church_memberships(id, users(full_name, avatar_url)), prayer_interactions(id)")
      .eq("church_id", churchId)
      .order("created_at", { ascending: false });

    if (status) builder = builder.eq("status", status as any);

    if (!this.isAdmin(membership)) {
      builder = builder.or(
        `membership_id.eq.${membership.id},visibility.eq.public_anonymous,visibility.eq.public_named`,
      );
    }

    const { data, error } = await builder;
    return this.supabase.unwrap(data ?? [], error);
  }

  async create(churchId: string, membership: MembershipSummary, dto: CreatePrayerRequestDto) {
    const { data, error } = await this.supabase.admin
      .from("prayer_requests")
      .insert({
        church_id: churchId,
        membership_id: membership.id,
        type: dto.type ?? "prayer",
        category: dto.category,
        title: dto.title,
        body: dto.body,
        visibility: dto.visibility ?? "pastors_only",
        status: "open",
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async getOne(churchId: string, requestId: string, membership: MembershipSummary) {
    const { data, error } = await this.supabase.admin
      .from("prayer_requests")
      .select("*, church_memberships(id, users(full_name, avatar_url)), prayer_interactions(*)")
      .eq("church_id", churchId)
      .eq("id", requestId)
      .maybeSingle();
    const request = this.supabase.single(data, error);
    if (!request) throw new NotFoundException("Prayer request not found");

    if (
      !this.isAdmin(membership) &&
      request.membership_id !== membership.id &&
      !["public_anonymous", "public_named"].includes(request.visibility)
    ) {
      throw new ForbiddenException("You cannot view this prayer request");
    }

    return request;
  }

  async update(
    churchId: string,
    requestId: string,
    membership: MembershipSummary,
    dto: UpdatePrayerRequestDto,
  ) {
    const existing = await this.getOne(churchId, requestId, membership);
    if (!this.isAdmin(membership) && existing.membership_id !== membership.id) {
      throw new ForbiddenException("You cannot edit this prayer request");
    }

    const { data, error } = await this.supabase.admin
      .from("prayer_requests")
      .update({
        type: dto.type,
        category: dto.category,
        title: dto.title,
        body: dto.body,
        visibility: dto.visibility,
        status: dto.status,
        updated_at: new Date().toISOString(),
      })
      .eq("church_id", churchId)
      .eq("id", requestId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async addInteraction(
    churchId: string,
    requestId: string,
    membership: MembershipSummary,
    dto: PrayerInteractionDto,
  ) {
    await this.getOne(churchId, requestId, membership);
    const { data, error } = await this.supabase.admin
      .from("prayer_interactions")
      .insert({
        request_id: requestId,
        author_membership_id: membership.id,
        body: dto.body,
        is_internal: this.isAdmin(membership) ? dto.isInternal ?? false : false,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }
}