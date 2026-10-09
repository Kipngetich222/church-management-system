import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
  ) {}

  async membersReport(churchId: string) {
    const admin = this.supabase.admin;
    const { data: memberships } = await admin
      .from('church_memberships')
      .select('id, role, badges, status, is_baptized, gender, joined_at')
      .eq('church_id', churchId);

    const rows = memberships ?? [];
    const byRole: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byGender: Record<string, number> = {};
    let baptized = 0;

    for (const row of rows) {
      byRole[row.role] = (byRole[row.role] ?? 0) + 1;
      const status = row.status ?? 'active';
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      const gender = row.gender ?? 'unspecified';
      byGender[gender] = (byGender[gender] ?? 0) + 1;
      if (row.is_baptized) baptized += 1;
    }

    return {
      total: rows.length,
      baptized,
      byRole,
      byStatus,
      byGender,
    };
  }

  async attendanceReport(churchId: string) {
    const { data, error } = await this.supabase.admin.rpc('attendance_by_event', {
      p_church_id: churchId,
    });
    return this.supabase.unwrap(data ?? [], error);
  }

  async memberGrowth(churchId: string) {
    const { data, error } = await this.supabase.admin.rpc('member_growth_by_month', {
      p_church_id: churchId,
    });
    return this.supabase.unwrap(data ?? [], error);
  }

  async financeReport(churchId: string, from: string, to: string) {
    return this.financeService.summary(churchId, from, to);
  }
}