import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { FinanceEngine } from '../../../../src/modules/finance/finance-engine'
import { FinanceError, type FinanceFilters } from '@/lib/finance'

export function financeEngine() {
  return new FinanceEngine(createAdminClient())
}
export async function financeUser(req?: Request) {
  if (req && !['GET', 'HEAD'].includes(req.method)) {
    const origin = req.headers.get('origin')
    if (origin && origin !== new URL(req.url).origin)
      throw new FinanceError('Forbidden request origin.', 403)
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new FinanceError('Please sign in to continue.', 401)
  return user
}
export function financeJson(value: unknown) {
  return Response.json(value, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
export function financeFailure(error: unknown) {
  const status =
    error instanceof FinanceError
      ? error.status
      : error instanceof SyntaxError
        ? 400
        : 503
  const message =
    error instanceof FinanceError
      ? error.message
      : error instanceof SyntaxError
        ? 'Invalid request body.'
        : 'Finance is temporarily unavailable. Please try again.'
  return Response.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'private, no-store' } }
  )
}
export function financeParams(params: URLSearchParams): {
  churchId: string
  filters: FinanceFilters
} {
  const filters: FinanceFilters = {}
  for (const key of [
    'from',
    'to',
    'currency',
    'kind',
    'status',
    'source',
    'method',
    'type',
    'categoryId',
    'campaignId',
    'reconciled',
    'documents',
    'search',
  ] as const)
    if (params.get(key)) filters[key] = params.get(key)!
  if (params.has('page')) filters.page = Number(params.get('page'))
  if (params.has('pageSize')) filters.pageSize = Number(params.get('pageSize'))
  return { churchId: params.get('churchId') ?? '', filters }
}
export function financeSearchParams(
  search: Record<string, string | string[] | undefined>
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search))
    if (typeof value === 'string') params.set(key, value)
  return params
}
export async function getFinanceSummary(
  churchId: string,
  from: string,
  to: string
) {
  const user = await financeUser()
  return (await financeEngine().summary(user.id, churchId, { from, to }))
    .summary
}
export async function listCampaigns(churchId: string) {
  const user = await financeUser()
  return financeEngine().campaigns(user.id, churchId)
}
export async function listPledges(churchId: string) {
  const user = await financeUser()
  return financeEngine().pledges(user.id, churchId)
}
export async function listExpenseCategories(churchId: string) {
  const user = await financeUser()
  return financeEngine().categories(user.id, churchId)
}
