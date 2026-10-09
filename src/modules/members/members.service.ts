import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { CreateMemberDto } from "./create-member.dto";
import { UpdateMemberDto } from "./update-member.dto";

@Injectable()
export class MembersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from("church_memberships")
      .select(
        `id, user_id, role, badges, is_baptized, status, joined_at,
         date_of_birth, gender, phone, address,
         users!inner(id, email, full_name, phone, avatar_url)`,
      )
      .eq("church_id", churchId)
      .order("joined_at", { ascending: false });
    return this.supabase.unwrap(data ?? [], error);
  }

  async getOne(churchId: string, membershipId: string) {
    const { data, error } = await this.supabase.admin
      .from("church_memberships")
      .select("*, users(id, email, full_name, phone, avatar_url)")
      .eq("church_id", churchId)
      .eq("id", membershipId)
      .maybeSingle();
    const row = this.supabase.single(data, error);
    if (!row) throw new NotFoundException("Membership not found");
    return row;
  }

  async create(churchId: string, dto: CreateMemberDto) {
    let userId = dto.userId;

    if (!userId && dto.email) {
      const { data: existing } = await this.supabase.admin
        .from("users")
        .select("id")
        .ilike("email", dto.email.trim())
        .maybeSingle();
      userId = existing?.id;
    }

    if (!userId) {
      throw new BadRequestException(
        "No matching user found. The person must sign up before being added to a church.",
      );
    }

    const { data, error } = await this.supabase.admin
      .from("church_memberships")
      .insert({
        user_id: userId,
        church_id: churchId,
        role: dto.role ?? "member",
        badges: (dto.badges ?? []) as any,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async update(churchId: string, membershipId: string, dto: UpdateMemberDto) {
    const { data, error } = await this.supabase.admin
      .from("church_memberships")
      .update({
        role: dto.role,
        badges: dto.badges as any,
        is_baptized: dto.isBaptized,
        status: dto.status,
        date_of_birth: dto.dateOfBirth,
        gender: dto.gender,
        phone: dto.phone,
        address: dto.address,
        notes: dto.notes,
      } as any)
      .eq("church_id", churchId)
      .eq("id", membershipId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async remove(churchId: string, membershipId: string) {
    const { error } = await this.supabase.admin
      .from("church_memberships")
      .delete()
      .eq("church_id", churchId)
      .eq("id", membershipId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  async import(churchId: string, members: CreateMemberDto[]) {
    const results = { created: 0, skipped: 0 };
    for (const member of members) {
      try {
        await this.create(churchId, member);
        results.created += 1;
      } catch {
        results.skipped += 1;
      }
    }
    return results;
  }
}