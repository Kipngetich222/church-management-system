import { FinanceError } from '@/lib/finance'
import {
  financeEngine,
  financeFailure,
  financeUser,
} from '@/lib/services/finance.service'
import { financeCsvRow } from '../../../../../../../src/modules/finance/finance-csv'
export async function GET(req: Request) {
  try {
    const user = await financeUser(),
      params = new URL(req.url).searchParams,
      churchId = params.get('churchId') ?? '',
      kind = params.get('kind'),
      engine = financeEngine()
    await engine.authorize(user.id, churchId)
    let rows: unknown[][]
    if (kind === 'pledge')
      rows = [
        [
          'Member',
          'Campaign',
          'Currency',
          'Total commitment',
          'Received',
          'Outstanding',
          'Start',
          'End / due',
          'Frequency',
          'Status',
          'Notes',
          'ID',
        ],
        ...(await engine.pledges(user.id, churchId)).map((p) => [
          p.member_name,
          p.campaign_name,
          p.currency,
          Number(p.amount_pledged),
          Number(p.received),
          Math.max(0, Number(p.amount_pledged) - Number(p.received)),
          p.starts_on,
          p.ends_on,
          p.frequency,
          p.status,
          p.notes,
          p.id,
        ]),
      ]
    else if (kind === 'budget')
      rows = [
        [
          'Category',
          'Currency',
          'Budget',
          'Spent',
          'Remaining',
          'Start',
          'End',
          'Status',
          'Notes',
          'ID',
        ],
        ...(await engine.budgets(user.id, churchId)).map((b) => [
          b.category_name,
          b.currency,
          Number(b.amount),
          Number(b.spent),
          Number(b.amount) - Number(b.spent),
          b.start_date,
          b.end_date,
          b.status,
          b.notes,
          b.id,
        ]),
      ]
    else if (kind === 'campaign')
      rows = [
        [
          'Campaign',
          'Currency',
          'Goal',
          'Received',
          'Start',
          'End',
          'Status',
          'Description',
          'ID',
        ],
        ...(await engine.campaigns(user.id, churchId)).map((c) => [
          c.name,
          c.currency,
          Number(c.goal_amount),
          Number(c.raised),
          c.start_date,
          c.end_date,
          c.status,
          c.description,
          c.id,
        ]),
      ]
    else throw new FinanceError('Select a valid plan type.')
    return new Response('\uFEFF' + rows.map(financeCsvRow).join(''), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="finance-${kind}s.csv"`,
      },
    })
  } catch (error) {
    return financeFailure(error)
  }
}
