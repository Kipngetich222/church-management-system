import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { UpdateUserDto } from "./update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async getById(userId: string) {
    const { data, error } = await this.supabase.admin
      .from("users")
      .select("id, email, full_name, phone, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();
    return this.supabase.single(data, error);
  }

  async update(userId: string, dto: UpdateUserDto) {
    const { data, error } = await this.supabase.admin
      .from("users")
      .update({
        full_name: dto.fullName,
        phone: dto.phone,
        avatar_url: dto.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }
}