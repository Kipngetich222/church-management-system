import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";
import { uniqueSlug } from "../../common/utils/slug";
import { CreateChurchDto } from "./create-church.dto";
import { UpdateChurchDto } from "./update-church.dto";

@Injectable()
export class ChurchesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(query?: string) {
    let builder = this.supabase.admin
      .from("churches")
      .select("id, name, slug, description, logo_url, address, latitude, longitude, phone, email, website, plan, created_at")
      .order("name", { ascending: true })
      .limit(100);

    if (query) builder = builder.ilike("name", `%${query}%`);

    const { data, error } = await builder;
    return this.supabase.unwrap(data ?? [], error);
  }

  async getById(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from("churches")
      .select("*")
      .eq("id", churchId)
      .maybeSingle();
    const church = this.supabase.single(data, error);
    if (!church) throw new NotFoundException("Church not found");
    return church;
  }

  async getBySlug(slug: string) {
    const { data, error } = await this.supabase.admin
      .from("churches")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    const church = this.supabase.single(data, error);
    if (!church) throw new NotFoundException("Church not found");
    return church;
  }

  async create(dto: CreateChurchDto, user: AuthUser) {
    const { data, error } = await this.supabase.admin
      .from("churches")
      .insert({
        name: dto.name,
        slug: uniqueSlug(dto.name),
        description: dto.description,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
        logo_url: dto.logoUrl,
        created_by: user.id,
      })
      .select()
      .single();

    const church = this.supabase.unwrap(data, error);

    await this.supabase.admin.from("church_memberships").insert({
      user_id: user.id,
      church_id: church.id,
      role: "super_admin",
      status: "active",
    });

    return church;
  }

  async update(churchId: string, dto: UpdateChurchDto) {
    const { data, error } = await this.supabase.admin
      .from("churches")
      .update({
        name: dto.name,
        description: dto.description,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
        logo_url: dto.logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", churchId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async stats(churchId: string) {
    const admin = this.supabase.admin;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [members, events, sermons, prayers, visitors] = await Promise.all([
      admin.from("church_memberships").select("id", { count: "exact", head: true }).eq("church_id", churchId),
      admin.from("events").select("id", { count: "exact", head: true }).eq("church_id", churchId),
      admin.from("sermons").select("id", { count: "exact", head: true }).eq("church_id", churchId),
      admin.from("prayer_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "open"),
      admin.from("visitors").select("id", { count: "exact", head: true }).eq("church_id", churchId),
    ]);

    const { data: offerings } = await admin
      .from("offerings")
      .select("amount")
      .eq("church_id", churchId)
      .gte("given_at", startOfMonth.toISOString());

    const monthTotal = (offerings ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

    return {
      members: members.count ?? 0,
      events: events.count ?? 0,
      sermons: sermons.count ?? 0,
      openPrayerRequests: prayers.count ?? 0,
      visitors: visitors.count ?? 0,
      monthOfferings: monthTotal,
    };
  }
}