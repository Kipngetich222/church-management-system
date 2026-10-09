import { createClient } from '@/lib/supabase/server'

export type OfferingRow = {
  id: string
  church_id: string
  membership_id: string | null
  amount: number
  currency: string
  type: string
  method: string
  reference: string | null
  notes: string | null
  receipt_number: string | null
  given_at: string
  church_memberships?: {
    users: { full_name: string | null; email: string } | null
  } | null
}

export type ExpenseRow = {
  id: string
  church_id: string
  category_id: string | null
  amount: number
  currency: string
  description: string
  method: string
  reference: string | null
  spent_at: string
  expense_categories?: { name: string; color: string } | null
}

export async function listOfferings(
  churchId: string,
  filters?: { from?: string; to?: string; type?: string }
): Promise<OfferingRow[]> {
  const supabase = await createClient()
  let q = supabase
    .from('offerings')
    .select(`
      id, church_id, membership_id, amount, currency, type, method,
      reference, notes, receipt_number, given_at,
      church_memberships(users(full_name, email))
    `)
    .eq('church_id', churchId)
    .order('given_at', { ascending: false })

  if (filters?.from) q = q.gte('given_at', filters.from)
  if (filters?.to) q = q.lte('given_at', filters.to)
  if (filters?.type)
    q = q.eq('type', filters.type as 'tithe' | 'general' | 'missions' | 'building_fund' | 'welfare' | 'thanksgiving' | 'pledge' | 'other')

  const { data, error } = await q.limit(500)
  if (error) throw error
  return (data ?? []) as unknown as OfferingRow[]
}

export async function listExpenses(
  churchId: string,
  filters?: { from?: string; to?: string; categoryId?: string }
): Promise<ExpenseRow[]> {
  const supabase = await createClient()
  let q = supabase
    .from('expenses')
    .select(`
      id, church_id, category_id, amount, currency, description,
      method, reference, spent_at,
      expense_categories(name, color)
    `)
    .eq('church_id', churchId)
    .order('spent_at', { ascending: false })

  if (filters?.from) q = q.gte('spent_at', filters.from)
  if (filters?.to) q = q.lte('spent_at', filters.to)
  if (filters?.categoryId) q = q.eq('category_id', filters.categoryId)

  const { data, error } = await q.limit(500)
  if (error) throw error
  return (data ?? []) as unknown as ExpenseRow[]
}

export async function listCampaigns(churchId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('campaigns')
    .select(`
      *,
      offerings(amount)
    `)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function listExpenseCategories(churchId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('church_id', churchId)
    .order('name')
  return data ?? []
}

export async function listPledges(churchId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pledges')
    .select(`
      *,
      church_memberships(users(full_name, email)),
      campaigns(name),
      offerings(amount)
    `)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export type FinanceSummary = {
  totalIncome: number
  totalExpense: number
  netBalance: number
  byType: { type: string; total: number }[]
  byCategory: { name: string; color: string; total: number }[]
  monthly: { month: string; income: number; expense: number }[]
}

export async function getFinanceSummary(
  churchId: string,
  from: string,
  to: string
): Promise<FinanceSummary> {
  const supabase = await createClient()

  const [{ data: offerings }, { data: expenses }] = await Promise.all([
    supabase.from('offerings').select('amount, type, given_at').eq('church_id', churchId)
      .gte('given_at', from).lte('given_at', to),
    supabase.from('expenses')
      .select('amount, spent_at, expense_categories(name, color)')
      .eq('church_id', churchId).gte('spent_at', from).lte('spent_at', to),
  ])

  const totalIncome = (offerings ?? []).reduce((s, o) => s + Number(o.amount), 0)
  const totalExpense = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)

  const typeMap = new Map<string, number>()
  offerings?.forEach((o) => {
    typeMap.set(o.type, (typeMap.get(o.type) ?? 0) + Number(o.amount))
  })

  const catMap = new Map<string, { color: string; total: number }>()
  expenses?.forEach((e: any) => {
    const name = e.expense_categories?.name ?? 'Uncategorized'
    const color = e.expense_categories?.color ?? '#94a3b8'
    const prev = catMap.get(name) ?? { color, total: 0 }
    prev.total += Number(e.amount)
    catMap.set(name, prev)
  })

  const monthMap = new Map<string, { income: number; expense: number }>()
  const monthKey = (d: string) => d.slice(0, 7)
  offerings?.forEach((o) => {
    const k = monthKey(o.given_at ?? '')
    const m = monthMap.get(k) ?? { income: 0, expense: 0 }
    m.income += Number(o.amount)
    monthMap.set(k, m)
  })
  expenses?.forEach((e: any) => {
    const k = monthKey(e.spent_at)
    const m = monthMap.get(k) ?? { income: 0, expense: 0 }
    m.expense += Number(e.amount)
    monthMap.set(k, m)
  })

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    byType: Array.from(typeMap).map(([type, total]) => ({ type, total })),
    byCategory: Array.from(catMap).map(([name, v]) => ({ name, ...v })),
    monthly: Array.from(monthMap)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  }
}

