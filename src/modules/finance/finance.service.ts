import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CreateCampaignDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateOfferingDto,
  CreatePledgeDto,
  FinanceRangeDto,
} from './finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly supabase: SupabaseService) {}

  // ---------------------------------------------------------------- offerings
  async listOfferings(churchId: string, range: FinanceRangeDto = {}) {
    let builder = this.supabase.admin
      .from('offerings')
      .select(
        `id, church_id, membership_id, amount, currency, type, method, reference,
         notes, receipt_number, given_at, church_memberships(users(full_name, email))`,
      )
      .eq('church_id', churchId)
      .order('given_at', { ascending: false })
      .limit(500);

    if (range.from) builder = builder.gte('given_at', range.from);
    if (range.to) builder = builder.lte('given_at', range.to);
    if (range.type) builder = builder.eq('type', range.type as any);

    const { data, error } = await builder;
    return this.supabase.unwrap(data ?? [], error);
  }

  async listMyGiving(churchId: string, membershipId: string) {
    const [{ data: offerings }, { data: pledges }] = await Promise.all([
      this.supabase.admin
        .from('offerings')
        .select('*')
        .eq('church_id', churchId)
        .eq('membership_id', membershipId)
        .order('given_at', { ascending: false }),
      this.supabase.admin
        .from('pledges')
        .select('*, campaigns(name)')
        .eq('church_id', churchId)
        .eq('membership_id', membershipId),
    ]);
    return { offerings: offerings ?? [], pledges: pledges ?? [] };
  }

  async createOffering(churchId: string, dto: CreateOfferingDto, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('offerings')
      .insert({
        church_id: churchId,
        membership_id: dto.membershipId ?? null,
        amount: dto.amount,
        currency: dto.currency ?? 'KES',
        type: dto.type ?? 'general',
        method: dto.method ?? 'cash',
        campaign_id: dto.campaignId ?? null,
        pledge_id: dto.pledgeId ?? null,
        reference: dto.reference,
        notes: dto.notes,
        given_at: dto.givenAt ?? new Date().toISOString(),
        recorded_by: userId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async removeOffering(churchId: string, offeringId: string) {
    const { error } = await this.supabase.admin
      .from('offerings')
      .delete()
      .eq('church_id', churchId)
      .eq('id', offeringId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  // ----------------------------------------------------------------- expenses
  async listExpenses(churchId: string, range: FinanceRangeDto = {}) {
    let builder = this.supabase.admin
      .from('expenses')
      .select(
        `id, church_id, category_id, amount, currency, description, method,
         reference, spent_at, expense_categories(name, color)`,
      )
      .eq('church_id', churchId)
      .order('spent_at', { ascending: false })
      .limit(500);

    if (range.from) builder = builder.gte('spent_at', range.from);
    if (range.to) builder = builder.lte('spent_at', range.to);
    if (range.categoryId) builder = builder.eq('category_id', range.categoryId);

    const { data, error } = await builder;
    return this.supabase.unwrap(data ?? [], error);
  }

  async createExpense(churchId: string, dto: CreateExpenseDto, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('expenses')
      .insert({
        church_id: churchId,
        category_id: dto.categoryId ?? null,
        amount: dto.amount,
        currency: dto.currency ?? 'KES',
        description: dto.description,
        method: dto.method ?? 'cash',
        reference: dto.reference,
        spent_at: dto.spentAt ?? new Date().toISOString(),
        recorded_by: userId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  async removeExpense(churchId: string, expenseId: string) {
    const { error } = await this.supabase.admin
      .from('expenses')
      .delete()
      .eq('church_id', churchId)
      .eq('id', expenseId);
    if (error) this.supabase.unwrap(null, error);
    return { success: true };
  }

  // ---------------------------------------------------------------- campaigns
  async listCampaigns(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('campaigns')
      .select('*, offerings(amount)')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false });
    return this.supabase.unwrap(data ?? [], error);
  }

  async createCampaign(churchId: string, dto: CreateCampaignDto, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('campaigns')
      .insert({
        church_id: churchId,
        name: dto.name,
        description: dto.description,
        goal_amount: dto.goalAmount,
        currency: dto.currency ?? 'KES',
        start_date: dto.startDate,
        end_date: dto.endDate,
        image_url: dto.imageUrl,
        created_by: userId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  // ------------------------------------------------------------------ pledges
  async listPledges(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('pledges')
      .select(
        `*, church_memberships(users(full_name, email)), campaigns(name), offerings(amount)`,
      )
      .eq('church_id', churchId)
      .order('created_at', { ascending: false });
    return this.supabase.unwrap(data ?? [], error);
  }

  async createPledge(churchId: string, dto: CreatePledgeDto, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('pledges')
      .insert({
        church_id: churchId,
        membership_id: dto.membershipId,
        campaign_id: dto.campaignId ?? null,
        amount_pledged: dto.amountPledged,
        currency: dto.currency ?? 'KES',
        frequency: dto.frequency ?? 'one_time',
        starts_on: dto.startsOn ?? new Date().toISOString().slice(0, 10),
        ends_on: dto.endsOn,
        notes: dto.notes,
        created_by: userId,
      })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  // ------------------------------------------------------- expense categories
  async listExpenseCategories(churchId: string) {
    const { data, error } = await this.supabase.admin
      .from('expense_categories')
      .select('*')
      .eq('church_id', churchId)
      .order('name');
    return this.supabase.unwrap(data ?? [], error);
  }

  async createExpenseCategory(churchId: string, dto: CreateExpenseCategoryDto) {
    const { data, error } = await this.supabase.admin
      .from('expense_categories')
      .insert({ church_id: churchId, name: dto.name, color: dto.color ?? '#6366f1' })
      .select()
      .single();
    return this.supabase.unwrap(data, error);
  }

  // ------------------------------------------------------------------ summary
  async summary(churchId: string, from: string, to: string) {
    const admin = this.supabase.admin;
    const [{ data: offerings }, { data: expenses }] = await Promise.all([
      admin
        .from('offerings')
        .select('amount, type, given_at')
        .eq('church_id', churchId)
        .gte('given_at', from)
        .lte('given_at', to),
      admin
        .from('expenses')
        .select('amount, spent_at, expense_categories(name, color)')
        .eq('church_id', churchId)
        .gte('spent_at', from)
        .lte('spent_at', to),
    ]);

    const totalIncome = (offerings ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
    const totalExpense = (expenses ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

    const typeMap = new Map<string, number>();
    for (const row of offerings ?? []) {
      typeMap.set(row.type, (typeMap.get(row.type) ?? 0) + Number(row.amount));
    }

    const categoryMap = new Map<string, { color: string; total: number }>();
    for (const row of (expenses ?? []) as any[]) {
      const name = row.expense_categories?.name ?? 'Uncategorized';
      const color = row.expense_categories?.color ?? '#94a3b8';
      const prev = categoryMap.get(name) ?? { color, total: 0 };
      prev.total += Number(row.amount);
      categoryMap.set(name, prev);
    }

    const monthMap = new Map<string, { income: number; expense: number }>();
    for (const row of offerings ?? []) {
      const key = (row.given_at ?? '').slice(0, 7);
      const entry = monthMap.get(key) ?? { income: 0, expense: 0 };
      entry.income += Number(row.amount);
      monthMap.set(key, entry);
    }
    for (const row of (expenses ?? []) as any[]) {
      const key = (row.spent_at ?? '').slice(0, 7);
      const entry = monthMap.get(key) ?? { income: 0, expense: 0 };
      entry.expense += Number(row.amount);
      monthMap.set(key, entry);
    }

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      byType: Array.from(typeMap).map(([type, total]) => ({ type, total })),
      byCategory: Array.from(categoryMap).map(([name, value]) => ({ name, ...value })),
      monthly: Array.from(monthMap)
        .map(([month, value]) => ({ month, ...value }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  }
}