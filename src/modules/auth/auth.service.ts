import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async emailExists(email: string): Promise<boolean> {
    const { data } = await this.supabase.admin
      .from("users")
      .select("id")
      .ilike("email", email.trim())
      .maybeSingle();
    return Boolean(data);
  }

  async getProfile(userId: string): Promise<AuthUser | null> {
    const { admin } = this.supabase;
    const [{ data: profile }, { data: memberships }] = await Promise.all([
      admin.from("users").select("id, email, full_name, phone, avatar_url").eq("id", userId).maybeSingle(),
      admin
        .from("church_memberships")
        .select("id, church_id, role, badges, status, is_baptized, churches(id, name, slug, logo_url)")
        .eq("user_id", userId),
    ]);

    if (!profile) return null;

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      avatarUrl: profile.avatar_url,
      memberships: (memberships ?? []).map((m) => ({
        id: m.id,
        churchId: m.church_id,
        role: m.role,
        badges: (m.badges ?? []) as string[],
        status: m.status ?? "active",
        isBaptized: Boolean(m.is_baptized),
      })),
    };
  }
}