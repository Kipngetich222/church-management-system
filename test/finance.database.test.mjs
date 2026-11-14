import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { asUser, createTestDatabase } from './helpers/supabase-test-db.mjs'

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const church = id(100),
  other = id(200),
  legacy = id(900),
  admin = id(1),
  member = id(2),
  dept = id(3),
  inactive = id(4),
  outsider = id(5)
let db, category, otherCategory
async function sql(statement, args = []) {
  await db.exec('SAVEPOINT finance_query')
  try {
    const result = await db.query(statement, args)
    await db.exec('RELEASE SAVEPOINT finance_query')
    return result
  } catch (error) {
    await db.exec(
      'ROLLBACK TO SAVEPOINT finance_query; RELEASE SAVEPOINT finance_query'
    )
    throw error
  }
}
const as = (user, query, args = []) =>
  asUser(db, user, () => db.query(query, args), user ? 'authenticated' : 'anon')
const summary = async (
  from = '2025-01-01T00:00:00+03:00',
  to = '2025-02-01T00:00:00+03:00',
  currency = 'KES'
) =>
  (
    await sql('SELECT public.finance_summary($1,$2,$3,$4) AS result', [
      church,
      from,
      to,
      currency,
    ])
  ).rows[0].result
async function expense({
  amount = 100,
  status = 'paid',
  date = '2025-01-15T09:00:00Z',
  invoice = '2025-01-15',
  due = null,
  request = null,
  cat = category,
  currency = 'KES',
} = {}) {
  return (
    await sql(
      `INSERT INTO public.expenses(church_id,category_id,amount,currency,description,payee,spent_at,invoice_date,due_date,status,recorded_by,request_id)
    VALUES($1,$2,$3,$4,'Electricity for January','Power supplier',$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        church,
        cat,
        amount,
        currency,
        date,
        invoice,
        due,
        status,
        admin,
        request,
      ]
    )
  ).rows[0]
}
async function gift({
  amount = 200,
  status = 'completed',
  date = '2025-01-15T09:00:00Z',
  type = 'general',
  currency = 'KES',
  campaign = null,
  pledge = null,
  membership = null,
} = {}) {
  return (
    await sql(
      `INSERT INTO public.offerings(church_id,amount,currency,type,status,given_at,recorded_by,campaign_id,pledge_id,membership_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        church,
        amount,
        currency,
        type,
        status,
        date,
        admin,
        campaign,
        pledge,
        membership,
      ]
    )
  ).rows[0]
}
async function purchase(n, environment = 'production') {
  const row = (
    await sql(
      `INSERT INTO public.sms_purchases(id,church_id,environment,request_id,credits,amount_kes,phone,status,checkout_id,created_by,created_by_name)
    VALUES($1,$2,$3,$4,100,200,'254712345678','pending',$5,$6,'Treasurer') RETURNING *`,
      [id(4000 + n), church, environment, id(5000 + n), `checkout-${n}`, admin]
    )
  ).rows[0]
  return row
}
async function payment(
  n,
  { environment = 'production', campaign = null, pledge = null } = {}
) {
  return (
    await sql(
      `INSERT INTO public.giving_payments(id,church_id,membership_id,user_id,request_id,amount,phone,type,environment,destination_type,destination_number,
    account_reference,business_shortcode,credentials_ciphertext,callback_token_hash,checkout_request_id,receipt_details,campaign_id,pledge_id)
    VALUES($1,$2,$3,$4,$1,500,'254712345678','tithe',$5,'paybill','123456','CHURCH','123456','encrypted-test',repeat('a',64),$6,
    '{"church":{"name":"Grace"},"donor":{"full_name":"Member"}}',$7,$8) RETURNING *`,
      [
        id(8000 + n),
        church,
        id(1002),
        member,
        environment,
        `giving-${n}`,
        campaign,
        pledge,
      ]
    )
  ).rows[0]
}
async function confirm(row) {
  return (
    await sql('SELECT * FROM public.confirm_giving_payment($1,$2,$3,$4)', [
      row.id,
      row.checkout_request_id,
      `ABC12345${row.id.slice(-3)}`,
      '2025-01-16T09:00:00Z',
    ])
  ).rows[0]
}

describe('Complete finance schema, permissions and accounting', () => {
  before(
    async () => {
      db = await createTestDatabase({
        beforeMigration: async (database, filename) => {
          if (filename !== '0047_finance_records.sql') return
          await database.query(
            "INSERT INTO public.churches(id,name,username) VALUES($1,'Existing Church','finance-existing')",
            [legacy]
          )
          await database.query(
            "INSERT INTO public.expenses(church_id,amount,description,spent_at) VALUES($1,42.35,'Existing filed cost','2025-01-10T09:00:00Z')",
            [legacy]
          )
          await database.query(
            `INSERT INTO public.sms_purchases(church_id,environment,request_id,credits,amount_kes,phone,status,created_by_name,paid_at,receipt)
        VALUES($1,'production',$2,100,200,'254712345678','paid','Former treasurer','2025-01-11T09:00:00Z','LEGACY123')`,
            [legacy, id(901)]
          )
          await database.query(
            "INSERT INTO public.churches(id,name,username) VALUES($1,'Matched Church','finance-matched')",
            [id(902)]
          )
          await database.query(
            `INSERT INTO public.expenses(id,church_id,amount,description,spent_at,method,reference,receipt_url)
        VALUES($1,$2,200,'Previously filed SMS purchase','2025-01-11T09:00:00Z','mpesa','MATCH123','https://files.example.test/sms.pdf')`,
            [id(903), id(902)]
          )
          await database.query(
            `INSERT INTO public.sms_purchases(church_id,environment,request_id,credits,amount_kes,phone,status,created_by_name,paid_at,receipt)
        VALUES($1,'production',$2,100,200,'254712345678','paid','Former treasurer','2025-01-11T09:00:00Z','MATCH123')`,
            [id(902), id(904)]
          )
        },
      })
      for (let n = 1; n <= 5; n++)
        await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [
          id(n),
          `finance-${n}@example.test`,
        ])
      await db.query(
        "UPDATE public.users SET full_name='Treasurer' WHERE id=$1",
        [admin]
      )
      await db.query(
        "INSERT INTO public.churches(id,name,username) VALUES($1,'Grace','finance-grace'),($2,'Other','finance-other')",
        [church, other]
      )
      for (const [n, role, scope, status] of [
        [1, 'super_admin', church, 'active'],
        [2, 'member', church, 'active'],
        [3, 'dept_admin', church, 'active'],
        [4, 'super_admin', church, 'inactive'],
        [5, 'super_admin', other, 'active'],
      ])
        await db.query(
          'INSERT INTO public.church_memberships(id,user_id,church_id,role,status) VALUES($1,$2,$3,$4,$5)',
          [id(1000 + n), id(n), scope, role, status]
        )
      category = (
        await db.query(
          "SELECT id FROM expense_categories WHERE church_id=$1 AND name='Electricity'",
          [church]
        )
      ).rows[0].id
      otherCategory = (
        await db.query(
          "SELECT id FROM expense_categories WHERE church_id=$1 AND name='Electricity'",
          [other]
        )
      ).rows[0].id
    },
    { timeout: 120_000 }
  )
  after(async () => {
    if (db) await db.close()
  })
  beforeEach(() => db.exec('BEGIN'))
  afterEach(() => db.exec('ROLLBACK'))

  it('preserves old expenses, snapshots their history and backfills confirmed production purchases once', async () => {
    const rows = (
      await sql('SELECT * FROM expenses WHERE church_id=$1 ORDER BY amount', [
        legacy,
      ])
    ).rows
    assert.deepEqual(
      rows.map((r) => Number(r.amount)),
      [42.35, 200]
    )
    assert.equal(
      new Date(rows[0].invoice_date).toISOString().slice(0, 10),
      '2025-01-10'
    )
    assert.equal(rows[1].source, 'sms_purchase')
    assert.equal(rows[1].recorded_by_name, 'Former treasurer')
    assert.equal(
      (
        await sql(
          "SELECT count(*)::int AS n FROM finance_audit WHERE church_id=$1 AND action='opening_record'",
          [legacy]
        )
      ).rows[0].n,
      1
    )
    await sql('UPDATE sms_purchases SET receipt=receipt WHERE church_id=$1', [
      legacy,
    ])
    assert.equal(
      (
        await sql(
          'SELECT count(*)::int AS n FROM expenses WHERE church_id=$1',
          [legacy]
        )
      ).rows[0].n,
      2
    )
    const names = (
      await sql('SELECT name FROM expense_categories WHERE church_id=$1', [
        legacy,
      ])
    ).rows.map((r) => r.name)
    for (const name of [
      'Electricity',
      'Transport',
      'Salaries',
      'Water',
      'SMS credits',
    ])
      assert(names.includes(name))
  })
  it('scopes expenses, bills, categories, documents and audit to active finance readers', async () => {
    const row = await expense()
    for (const user of [member, dept, inactive, outsider]) {
      for (const table of ['expenses', 'expense_categories', 'finance_audit'])
        assert.equal(
          (
            await as(user, `SELECT * FROM public.${table} WHERE church_id=$1`, [
              church,
            ])
          ).rows.length,
          0
        )
    }
    assert.equal(
      (await as(admin, 'SELECT * FROM expenses WHERE id=$1', [row.id])).rows
        .length,
      1
    )
    await sql(
      "UPDATE role_permissions SET permissions=ARRAY['finance:read'] WHERE church_id=$1 AND role='dept_admin'",
      [church]
    )
    assert.equal(
      (await as(dept, 'SELECT * FROM expenses WHERE id=$1', [row.id])).rows
        .length,
      1
    )
    await assert.rejects(
      as(
        dept,
        "INSERT INTO expenses(church_id,amount,description) VALUES($1,1,'forged')",
        [church]
      ),
      /permission denied/i
    )
    await assert.rejects(
      as(admin, "SELECT finance_summary($1,now(),now()+interval '1 day')", [
        church,
      ]),
      /permission denied/i
    )
    await assert.rejects(
      as(member, 'SELECT * FROM finance_register'),
      /permission denied/i
    )
    await assert.rejects(
      as(null, 'SELECT * FROM expenses'),
      /permission denied/i
    )
  })
  it('rejects zero or negative spending, cross-church categories, reversed service periods and duplicate submissions', async () => {
    await assert.rejects(
      expense({ amount: -1 }),
      /greater than zero|check constraint/i
    )
    await assert.rejects(expense({ amount: 0 }), /greater than zero/i)
    await assert.rejects(
      expense({ cat: otherCategory }),
      /belong to this church/i
    )
    await assert.rejects(
      sql(
        "INSERT INTO expenses(church_id,amount,description,period_start,period_end) VALUES($1,10,'invalid','2025-02-01','2025-01-01')",
        [church]
      ),
      /expense_service_period/i
    )
    await expense({ request: id(9000) })
    await assert.rejects(expense({ request: id(9000) }), /duplicate key/i)
  })
  it('uses every row and exact decimal totals with inclusive Nairobi boundaries and separate currencies', async () => {
    await sql(
      `INSERT INTO offerings(church_id,amount,type,given_at) SELECT $1,10,'general','2025-01-01T09:00:00Z' FROM generate_series(1,1505)`,
      [church]
    )
    await gift({ amount: 7, date: '2024-12-31T20:59:59.999Z' })
    await gift({ amount: 0.1, type: 'tithe', date: '2024-12-31T21:00:00Z' })
    await gift({ amount: 0.2, type: 'tithe', date: '2025-01-31T20:59:59.999Z' })
    await gift({ amount: 800, date: '2025-01-31T21:00:00Z' })
    await gift({ amount: 1000, currency: 'USD' })
    for (const status of ['test', 'review', 'pending', 'failed', 'voided'])
      await gift({ amount: 99000, status })
    await expense({ amount: 3.1 })
    const result = await summary()
    assert.equal(result.totalIncome, 15050.3)
    assert.equal(result.totalExpense, 3.1)
    assert.equal(result.netBalance, 15047.2)
    assert.equal(result.openingBalance, 7)
    assert.equal(result.closingBalance, 15054.2)
    assert.equal(result.byType.find((r) => r.type === 'tithe').total, 0.3)
    assert.equal(result.monthly.length, 1)
    assert.equal(result.monthly[0].month, '2025-01')
    assert.equal(result.excludedCount, 5)
    assert.equal((await summary(undefined, undefined, 'USD')).totalIncome, 1000)
  })
  it('separates outstanding bills from paid expenses, including a bill paid after the selected period', async () => {
    const row = await expense({
      status: 'unpaid',
      invoice: '2025-01-02',
      due: '2025-01-10',
    })
    assert.equal(row.spent_at, null)
    const initial = await summary()
    assert.equal(initial.totalExpense, 0)
    assert.equal(initial.outstandingBills, 100)
    assert.equal(initial.overdueBills, 100)
    await sql(
      "UPDATE expenses SET status='paid',spent_at='2025-02-03T12:00:00Z',method='bank_transfer',reference='BANK-PAID',change_reason='Invoice paid',updated_by=$2 WHERE id=$1",
      [row.id, admin]
    )
    assert.equal((await summary()).outstandingBills, 100)
    const feb = await summary(
      '2025-02-01T00:00:00+03:00',
      '2025-03-01T00:00:00+03:00'
    )
    assert.equal(feb.totalExpense, 100)
    assert.equal(feb.outstandingBills, 0)
    const audit = (
      await sql(
        "SELECT * FROM finance_audit WHERE entity_id=$1 AND action='paid'",
        [row.id]
      )
    ).rows[0]
    assert.equal(audit.actor_name, 'Treasurer')
    assert.equal(audit.before_data.status, 'unpaid')
    assert.equal(audit.after_data.reference, 'BANK-PAID')
    await assert.rejects(
      sql(
        "UPDATE expenses SET status='unpaid',change_reason='Undo' WHERE id=$1",
        [row.id]
      ),
      /cannot return to unpaid/i
    )
  })
  it('retains voids and receipts, excludes them from totals and requires a change reason', async () => {
    const row = await gift({ membership: id(1002) }),
      cost = await expense()
    await assert.rejects(
      sql("UPDATE offerings SET status='voided' WHERE id=$1", [row.id]),
      /reason is required/i
    )
    await sql(
      "UPDATE offerings SET status='voided',change_reason='Duplicate cash count',updated_by=$2 WHERE id=$1",
      [row.id, admin]
    )
    await sql(
      "UPDATE expenses SET status='voided',change_reason='Incorrect invoice',updated_by=$2 WHERE id=$1",
      [cost.id, admin]
    )
    const after = (await sql('SELECT * FROM offerings WHERE id=$1', [row.id]))
      .rows[0]
    assert.equal(after.receipt_number, row.receipt_number)
    assert(after.voided_at)
    assert.equal((await summary()).totalIncome, 0)
    assert.equal((await summary()).totalExpense, 0)
    await assert.rejects(
      sql('DELETE FROM expenses WHERE id=$1', [cost.id]),
      /cannot be deleted/i
    )
    await assert.rejects(
      sql(
        "UPDATE offerings SET status='completed',change_reason='restore' WHERE id=$1",
        [row.id]
      ),
      /voided.*cannot be changed/i
    )
    await assert.rejects(
      sql("UPDATE finance_audit SET reason='tampered' WHERE entity_id=$1", [
        row.id,
      ]),
      /immutable/i
    )
  })
  it('keeps amounts and allocations immutable while preserving reconciliation changes', async () => {
    const row = await expense()
    await assert.rejects(
      sql("UPDATE expenses SET amount=999,change_reason='edit' WHERE id=$1", [
        row.id,
      ]),
      /void and replace/i
    )
    await assert.rejects(
      sql(
        "UPDATE expenses SET reconciled_at=now(),change_reason='checked' WHERE id=$1",
        [row.id]
      ),
      /statement reference/i
    )
    await sql(
      "UPDATE expenses SET reconciled_at=now(),reconciliation_reference='January statement line 4',change_reason='Matched statement',updated_by=$2 WHERE id=$1",
      [row.id, admin]
    )
    assert.equal((await summary()).unreconciledCount, 0)
    assert.equal(
      (
        await sql(
          "SELECT count(*)::int AS n FROM finance_audit WHERE entity_id=$1 AND action='reconciled'",
          [row.id]
        )
      ).rows[0].n,
      1
    )
  })
  it('captures production SMS purchases once, adds late references and never counts sandbox or usage as a second expense', async () => {
    const p = await purchase(1)
    assert.equal(
      (
        await sql(
          'SELECT count(*)::int AS n FROM expenses WHERE church_id=$1',
          [church]
        )
      ).rows[0].n,
      0
    )
    await sql('SELECT confirm_sms_purchase($1,$2)', [p.id, p.checkout_id])
    await sql('SELECT confirm_sms_purchase($1,$2,$3)', [
      p.id,
      p.checkout_id,
      'SMS123456',
    ])
    await sql('SELECT confirm_sms_purchase($1,$2,$3)', [
      p.id,
      p.checkout_id,
      'SMS123456',
    ])
    const test = await purchase(2, 'sandbox')
    await sql('SELECT confirm_sms_purchase($1,$2)', [test.id, test.checkout_id])
    const rows = (
      await sql('SELECT * FROM expenses WHERE church_id=$1', [church])
    ).rows
    assert.equal(rows.length, 1)
    assert.equal(rows[0].reference, 'SMS123456')
    assert.equal(Number(rows[0].amount), 200)
    assert.equal(rows[0].source, 'sms_purchase')
    await assert.rejects(
      sql(
        "UPDATE expenses SET status='voided',change_reason='remove' WHERE id=$1",
        [rows[0].id]
      ),
      /system payment/i
    )
  })
  it('links an exact previously filed SMS payment during migration without duplicating spending or losing its filing', async () => {
    const rows = (
      await sql('SELECT * FROM expenses WHERE church_id=$1', [id(902)])
    ).rows
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, id(903))
    assert.equal(rows[0].source, 'sms_purchase')
    assert.equal(rows[0].description, 'Previously filed SMS purchase')
    assert.equal(rows[0].receipt_url, 'https://files.example.test/sms.pdf')
    const history = (
      await sql(
        "SELECT * FROM finance_audit WHERE entity_id=$1 AND action='source_linked'",
        [id(903)]
      )
    ).rows
    assert.equal(history.length, 1)
    assert.equal(history[0].actor_name, 'System')
    assert.equal(history[0].before_data.source, 'manual')
    assert.equal(history[0].after_data.source, 'sms_purchase')
    assert.equal(
      Number(history[0].before_data.amount),
      Number(history[0].after_data.amount)
    )
    await sql('UPDATE sms_purchases SET receipt=receipt WHERE church_id=$1', [
      id(902),
    ])
    assert.equal(
      (
        await sql(
          'SELECT count(*)::int AS n FROM expenses WHERE church_id=$1',
          [id(902)]
        )
      ).rows[0].n,
      1
    )
  })
  it('keeps uncertain SMS matches for review rather than silently changing existing amounts', async () => {
    await sql(
      `INSERT INTO expenses(church_id,category_id,amount,description,payee,method,reference)
      VALUES($1,$2,150,'SMS cost','SMS supplier','mpesa','CHECK123')`,
      [church, category]
    )
    const p = await purchase(3)
    await sql('SELECT confirm_sms_purchase($1,$2,$3)', [
      p.id,
      p.checkout_id,
      'CHECK123',
    ])
    const rows = (
      await sql(
        'SELECT source,amount FROM expenses WHERE church_id=$1 ORDER BY amount',
        [church]
      )
    ).rows
    assert.deepEqual(
      rows.map((r) => [r.source, Number(r.amount)]),
      [
        ['manual', 150],
        ['sms_purchase', 200],
      ]
    )
  })
  it('keeps paid event fees separate from giving and records an actual refund as a second cash movement', async () => {
    await sql(
      "INSERT INTO events(id,church_id,title,slug,start_time) VALUES($1,$2,'Conference','finance-conference','2025-02-01')",
      [id(6000), church]
    )
    const row = (
      await sql(
        "INSERT INTO event_registrations(event_id,guest_name,payment_status,amount_paid,paid_at,payment_reference) VALUES($1,'Guest','paid',500,'2025-01-15T10:00:00Z','EVT-123') RETURNING *",
        [id(6000)]
      )
    ).rows[0]
    await sql(
      'UPDATE event_registrations SET payment_reference=payment_reference WHERE id=$1',
      [row.id]
    )
    assert.equal((await summary()).totalIncome, 500)
    assert.equal(
      (
        await sql(
          'SELECT count(*)::int AS n FROM offerings WHERE church_id=$1',
          [church]
        )
      ).rows[0].n,
      0
    )
    await sql(
      "UPDATE event_registrations SET payment_status='refunded',refunded_at='2025-01-20T10:00:00Z' WHERE id=$1",
      [row.id]
    )
    const result = await summary()
    assert.equal(result.totalIncome, 500)
    assert.equal(result.totalExpense, 500)
    assert.equal(result.netBalance, 0)
    await assert.rejects(
      sql("UPDATE event_registrations SET payment_status='paid' WHERE id=$1", [
        row.id,
      ]),
      /cannot be paid again/i
    )
    await sql('DELETE FROM events WHERE id=$1', [id(6000)])
    assert.equal((await summary()).totalIncome, 500)
  })
  it('allocates online and manual giving to pledges and campaigns while excluding tests and voids', async () => {
    const campaign = (
      await sql(
        "INSERT INTO campaigns(church_id,name,goal_amount,start_date) VALUES($1,'Building',10000,'2025-01-01') RETURNING id",
        [church]
      )
    ).rows[0].id
    const pledge = (
      await sql(
        'INSERT INTO pledges(church_id,membership_id,campaign_id,amount_pledged) VALUES($1,$2,$3,2000) RETURNING id',
        [church, id(1002), campaign]
      )
    ).rows[0].id
    const manual = await gift({
      campaign,
      pledge,
      membership: id(1002),
      amount: 100,
    })
    const production = await confirm(await payment(1, { campaign, pledge }))
    await confirm(
      await payment(2, { campaign, pledge, environment: 'sandbox' })
    )
    let progress = (
      await sql('SELECT * FROM finance_pledge_progress WHERE id=$1', [pledge])
    ).rows[0]
    assert.equal(Number(progress.received), 600)
    await sql(
      "UPDATE offerings SET status='voided',change_reason='Duplicate manual receipt' WHERE id=$1",
      [manual.id]
    )
    assert.equal(
      Number(
        (
          await sql('SELECT * FROM finance_campaign_progress WHERE id=$1', [
            campaign,
          ])
        ).rows[0].raised
      ),
      500
    )
    await assert.rejects(
      sql('UPDATE giving_payments SET pledge_id=NULL WHERE id=$1', [
        production.id,
      ]),
      /allocation.*cannot change/i
    )
    await sql('DELETE FROM church_memberships WHERE id=$1', [id(1002)])
    progress = (
      await sql('SELECT * FROM finance_pledge_progress WHERE id=$1', [pledge])
    ).rows[0]
    assert.equal(progress.membership_id, null)
    assert(progress.member_name)
    assert.equal(Number(progress.received), 500)
  })
  it('rejects cross-church or cross-currency campaigns and pledge/member mismatches', async () => {
    const c = (
      await sql(
        "INSERT INTO campaigns(church_id,name,goal_amount,start_date,currency) VALUES($1,'Dollar campaign',500,'2025-01-01','USD') RETURNING id",
        [church]
      )
    ).rows[0].id
    await assert.rejects(gift({ campaign: c }), /currencies must match/i)
    await assert.rejects(payment(1, { campaign: c }), /active KES campaign/i)
    const p = (
      await sql(
        'INSERT INTO pledges(church_id,membership_id,amount_pledged) VALUES($1,$2,100) RETURNING id',
        [church, id(1002)]
      )
    ).rows[0].id
    await assert.rejects(
      gift({ pledge: p, membership: id(1001) }),
      /match the pledge/i
    )
    await assert.rejects(
      sql(
        'INSERT INTO pledges(church_id,membership_id,amount_pledged) VALUES($1,$2,100)',
        [church, id(1005)]
      ),
      /belong to this church/i
    )
  })
  it('can confirm an allocated payment after the member leaves while keeping the pledge and donor history', async () => {
    const pledge = (
      await sql(
        'INSERT INTO pledges(church_id,membership_id,amount_pledged) VALUES($1,$2,1000) RETURNING id',
        [church, id(1002)]
      )
    ).rows[0].id
    const pending = await payment(3, { pledge })
    await sql('DELETE FROM church_memberships WHERE id=$1', [id(1002)])
    const paid = await confirm(pending)
    const row = (
      await sql('SELECT * FROM offerings WHERE id=$1', [paid.offering_id])
    ).rows[0]
    assert.equal(row.membership_id, null)
    assert.equal(row.pledge_id, pledge)
    assert.equal(row.receipt_details.donor.full_name, 'Member')
    assert.equal(
      Number(
        (
          await sql(
            'SELECT received FROM finance_pledge_progress WHERE id=$1',
            [pledge]
          )
        ).rows[0].received
      ),
      500
    )
  })
  it('compares a budget with only paid expenses in its category, currency and inclusive period', async () => {
    const b = (
      await sql(
        "INSERT INTO finance_budgets(church_id,request_id,category_id,amount,start_date,end_date) VALUES($1,$2,$3,500,'2025-01-01','2025-01-31') RETURNING id",
        [church, id(10000), category]
      )
    ).rows[0]
    // BEFORE INSERT validation runs before the unique request-id constraint.
    await assert.rejects(
      sql(
        "INSERT INTO finance_budgets(church_id,request_id,category_id,amount,start_date,end_date) VALUES($1,$2,$3,500,'2025-01-01','2025-01-31')",
        [church, id(10000), category]
      ),
      {
        code: '23514',
        message: 'An active budget already covers this category and period',
      }
    )
    await expense({ amount: 120 })
    await expense({ amount: 30, status: 'unpaid' })
    await expense({ amount: 90, currency: 'USD' })
    await expense({ amount: 70, date: '2025-02-01T09:00:00Z' })
    assert.equal(
      Number(
        (await sql('SELECT * FROM finance_budget_progress WHERE id=$1', [b.id]))
          .rows[0].spent
      ),
      120
    )
    await assert.rejects(
      sql(
        "INSERT INTO finance_budgets(church_id,request_id,category_id,amount,start_date,end_date) VALUES($1,$2,$3,500,'2025-01-15','2025-02-15')",
        [church, id(10001), category]
      ),
      /already covers/i
    )
    await sql(
      "UPDATE finance_budgets SET status='cancelled',change_reason='Budget replaced' WHERE id=$1",
      [b.id]
    )
    await sql(
      "INSERT INTO finance_budgets(church_id,request_id,category_id,amount,start_date,end_date) VALUES($1,$2,$3,700,'2025-01-01','2025-01-31')",
      [church, id(10002), category]
    )
  })
  it('keeps document storage private and document metadata immutable and isolated', async () => {
    const row = await expense(),
      file = `${church}/expense/${row.id}/proof.pdf`
    const doc = (
      await sql(
        "INSERT INTO finance_documents(church_id,entity_type,entity_id,file_path,file_name,mime_type,size_bytes,uploaded_by,uploaded_by_name) VALUES($1,'expense',$2,$3,'Invoice.pdf','application/pdf',50,$4,'Treasurer') RETURNING id",
        [church, row.id, file, admin]
      )
    ).rows[0]
    await sql(
      "INSERT INTO storage.objects(bucket_id,name) VALUES('finance-documents',$1)",
      [file]
    )
    assert.equal(
      (
        await sql(
          "SELECT public FROM storage.buckets WHERE id='finance-documents'"
        )
      ).rows[0].public,
      false
    )
    for (const user of [admin, member, outsider])
      assert.equal(
        (
          await as(
            user,
            "SELECT * FROM storage.objects WHERE bucket_id='finance-documents'"
          )
        ).rows.length,
        0
      )
    assert.equal(
      (await as(admin, 'SELECT * FROM finance_documents WHERE id=$1', [doc.id]))
        .rows.length,
      1
    )
    assert.equal(
      (
        await as(member, 'SELECT * FROM finance_documents WHERE id=$1', [
          doc.id,
        ])
      ).rows.length,
      0
    )
    await assert.rejects(
      sql(
        "UPDATE finance_documents SET file_name='replacement.pdf' WHERE id=$1",
        [doc.id]
      ),
      /immutable/i
    )
    assert.equal((await summary()).missingDocumentsCount, 0)
    await sql('DELETE FROM public.users WHERE id=$1', [admin])
    assert.equal(
      (
        await sql(
          'SELECT uploaded_by_name FROM finance_documents WHERE id=$1',
          [doc.id]
        )
      ).rows[0].uploaded_by_name,
      'Treasurer'
    )
    assert(
      (
        await sql(
          "SELECT 1 FROM finance_audit WHERE entity_id=$1 AND actor_name='Treasurer'",
          [row.id]
        )
      ).rows.length
    )
  })
  it('allows an authorized church deletion to remove its complete finance scope', async () => {
    await expense()
    await gift()
    await sql(
      "INSERT INTO finance_budgets(church_id,request_id,category_id,amount,start_date,end_date) VALUES($1,$2,$3,100,'2025-01-01','2025-01-31')",
      [church, id(11000), category]
    )
    await sql('DELETE FROM churches WHERE id=$1', [church])
    await sql('SET CONSTRAINTS ALL IMMEDIATE')
    for (const table of [
      'offerings',
      'expenses',
      'finance_audit',
      'finance_budgets',
    ])
      assert.equal(
        (
          await sql(
            `SELECT count(*)::int AS n FROM ${table} WHERE church_id=$1`,
            [church]
          )
        ).rows[0].n,
        0
      )
  })
})
