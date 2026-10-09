import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./department.dto";

@Injectable()
export class DepartmentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from("departments")
      .select("*, department_members(id, membership_id, is_leader)")
      .eq("church_id", churchId)
      .order("name");
    return this.supabase.unwrap(data ?? [], error);
  }

  async create(churchId: string, dto: CreateDepartmentDto) {
    const { data, error } = await this.supabase.admin
      .from("departments")
      .insert({ church_id: churchId, ...dto })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async update(churchId: string, departmentId: string, dto: UpdateDepartmentDto) {
    const { data, error } = await this.supabase.admin
      .from("departments")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("church_id", churchId)
      .eq("id", departmentId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async remove(churchId: string, departmentId: string) {
    const { error } = await this.supabase.admin
      .from("departments")
      .delete()
      .eq("church_id", churchId)
      .eq("id", departmentId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  async addMember(churchId: string, departmentId: string, membershipId: string, isLeader = false) {
    const { data, error } = await this.supabase.admin
      .from("department_members")
      .insert({ department_id: departmentId, membership_id: membershipId, is_leader: isLeader })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async promote(churchId: string, departmentId: string, membershipId: string) {
    const { data, error } = await this.supabase.admin
      .from("department_members")
      .update({ is_leader: true })
      .eq("department_id", departmentId)
      .eq("membership_id", membershipId)
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async removeMember(churchId: string, departmentId: string, membershipId: string) {
    const { error } = await this.supabase.admin
      .from("department_members")
      .delete()
      .eq("department_id", departmentId)
      .eq("membership_id", membershipId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }
}