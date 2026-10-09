import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseService) {}

  async log(params: {
    churchId: string;
    actorId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.supabase.admin.from("audit_logs").insert({
      church_id: params.churchId,
      actor_id: params.actorId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: (params.metadata ?? {}) as any,
    });
  }

  async list(churchId: string, limit = 100) {
    const { data, error } = await this.supabase.admin
      .from("audit_logs")
      .select("*, users(id, full_name, email)")
      .eq("church_id", churchId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return this.supabase.unwrap(data ?? [], error);
  }
}