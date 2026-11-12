import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { asUser, createTestDatabase } from './helpers/supabase-test-db.mjs'

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const church = id(100),
  otherChurch = id(200),
  legacyChurch = id(300)
const admin = id(1),
  member = id(2),
  peer = id(3),
  outsider = id(4),
  inactive = id(5),
  deptAdmin = id(6)
let db
const queryAs = (user, sql, params = []) =>
  asUser(db, user, () => db.query(sql, params), user ? 'authenticated' : 'anon')
async function service(sql, params = []) {
  await db.exec('SAVEPOINT service_request')
  try {
    const result = await db.query(sql, params)
    await db.exec('RELEASE SAVEPOINT service_request')
    return result
  } catch (error) {
    await db.exec(
      'ROLLBACK TO SAVEPOINT service_request; RELEASE SAVEPOINT service_request'
    )
    throw error
  }
}
const insertPayment = (n = 1, environment = 'production') =>
  service(
    `
  INSERT INTO public.giving_payments(id, church_id, membership_id, user_id, request_id,
    amount, phone, type, environment, destination_type, destination_number, account_reference,
    business_shortcode, credentials_ciphertext, callback_token_hash, checkout_request_id, receipt_details)
  VALUES ($1, $2, $3, $4, $1, 500, '254712345678', 'project_fund', $5, 'paybill', '123456',
    'CHURCH', '123456', 'encrypted-test-value', repeat('a',64), $6,
    '{"church":{"name":"Grace Church","logo_url":"https://example.test/logo.png"},"donor":{"full_name":"Giving Member","email":"member@example.test"},"phone":"254712345678"}')
  RETURNING *`,
    [id(3000 + n), church, id(1002), member, environment, `checkout-${n}`]
  ).then((result) => result.rows[0])
const confirm = (payment, receipt = 'ABC1234567') =>
  service('SELECT * FROM public.confirm_giving_payment($1, $2, $3)', [
    payment.id,
    payment.checkout_request_id,
    receipt,
  ]).then((result) => result.rows[0])

describe('Giving ledger, receipts and tenant privacy against the complete database', () => {
  before(
    async () => {
      db = await createTestDatabase({
        beforeMigration: async (database, filename) => {
          if (filename !== '0046_giving_payments.sql') return
          await database.query(
            "INSERT INTO public.churches(id, name, username) VALUES ($1, 'Legacy Church', 'giving-legacy')",
            [legacyChurch]
          )
          await database.query(
            `INSERT INTO public.offerings(church_id, amount, method, notes, reference) VALUES
          ($1, 100, 'mpesa', 'Awaiting M-Pesa confirmation', 'MPESA-old-pending'),
          ($1, 200, 'mpesa', 'M-Pesa failed: cancelled', 'MPESA-old-failed'),
          ($1, 300, 'mpesa', 'M-Pesa confirmed', 'OLD1234567'),
          ($1, 400, 'cash', 'Sunday offering', NULL)`,
            [legacyChurch]
          )
        },
      })
      for (let n = 1; n <= 6; n++)
        await db.query('INSERT INTO auth.users(id, email) VALUES ($1,$2)', [
          id(n),
          `giving-${n}@example.test`,
        ])
      await db.query(
        "INSERT INTO public.churches(id, name, username) VALUES ($1, 'Grace Church', 'giving-grace'), ($2, 'Other Church', 'giving-other')",
        [church, otherChurch]
      )
      for (const [n, role, churchId, status] of [
        [1, 'super_admin', church, 'active'],
        [2, 'member', church, 'active'],
        [3, 'member', church, 'active'],
        [4, 'super_admin', otherChurch, 'active'],
        [5, 'super_admin', church, 'inactive'],
        [6, 'dept_admin', church, 'active'],
      ])
        await db.query(
          'INSERT INTO public.church_memberships(id, user_id, church_id, role, status) VALUES ($1,$2,$3,$4,$5)',
          [id(1000 + n), id(n), churchId, role, status]
        )
    },
    { timeout: 120_000 }
  )
  after(async () => {
    if (db) await db.close()
  })
  beforeEach(() => db.exec('BEGIN'))
  afterEach(() => db.exec('ROLLBACK'))

  it('migrates legacy pending and failed STK attempts out of income and revokes their receipts', async () => {
    const rows = (
      await service(
        'SELECT * FROM public.offerings WHERE church_id=$1 ORDER BY amount',
        [legacyChurch]
      )
    ).rows
    assert.deepEqual(
      rows.map((row) => row.status),
      ['review', 'failed', 'completed', 'completed']
    )
    assert.equal(rows[0].receipt_number, null)
    assert.equal(rows[1].receipt_number, null)
    assert.match(rows[2].receipt_number, /^RCP-/)
    assert.match(rows[3].receipt_number, /^RCP-/)
    assert.equal(
      rows
        .filter((row) => row.status === 'completed')
        .reduce((sum, row) => sum + Number(row.amount), 0),
      700
    )
  })
  it('keeps credentials and raw payment attempts inaccessible even to authenticated admins', async () => {
    await insertPayment()
    for (const user of [null, admin, member, outsider])
      for (const table of [
        'church_giving_settings',
        'giving_payments',
        'giving_history',
      ])
        await assert.rejects(
          queryAs(user, `SELECT * FROM public.${table}`),
          /permission denied/i
        )
    await assert.rejects(
      queryAs(admin, 'SELECT * FROM public.confirm_giving_payment($1,$2)', [
        id(3001),
        'checkout-1',
      ]),
      /permission denied/i
    )
  })
  it('creates one ledger entry and a stable receipt only after confirmation', async () => {
    const payment = await insertPayment()
    assert.equal(
      (
        await service(
          'SELECT count(*)::int AS n FROM public.offerings WHERE church_id=$1',
          [church]
        )
      ).rows[0].n,
      0
    )
    const first = await confirm(payment)
    const again = await confirm(payment)
    assert.equal(first.status, 'succeeded')
    assert.equal(first.offering_id, again.offering_id)
    const rows = (
      await service('SELECT * FROM public.offerings WHERE payment_id=$1', [
        payment.id,
      ])
    ).rows
    assert.equal(rows.length, 1)
    assert.equal(Number(rows[0].amount), 500)
    assert.equal(rows[0].status, 'completed')
    assert.match(rows[0].receipt_number, /^RCP-\d{4}-\d{6,}$/)
    assert.equal(rows[0].reference, 'ABC1234567')
    assert.equal(rows[0].receipt_details.church.name, 'Grace Church')
    assert.equal(rows[0].receipt_details.donor.full_name, 'Giving Member')
  })
  it('accepts a late receipt without creating another offering', async () => {
    const payment = await insertPayment()
    const first = await confirm(payment, null)
    const later = await confirm(payment, 'LATE123456')
    assert.equal(later.offering_id, first.offering_id)
    assert.equal(later.mpesa_receipt, 'LATE123456')
    await assert.rejects(
      confirm(payment, 'OTHER12345'),
      /receipt does not match/i
    )
  })
  it('rejects a wrong checkout and a reused provider receipt atomically', async () => {
    const first = await insertPayment()
    await assert.rejects(
      service('SELECT * FROM public.confirm_giving_payment($1,$2)', [
        first.id,
        'other-checkout',
      ]),
      /checkout does not match/i
    )
    await confirm(first)
    const second = await insertPayment(2)
    await assert.rejects(confirm(second), /duplicate key/i)
    assert.equal(
      (
        await service(
          'SELECT count(*)::int AS n FROM public.offerings WHERE church_id=$1',
          [church]
        )
      ).rows[0].n,
      1
    )
    assert.equal(
      (
        await service('SELECT status FROM public.giving_payments WHERE id=$1', [
          second.id,
        ])
      ).rows[0].status,
      'initiating'
    )
  })
  it('marks sandbox receipts and excludes sandbox success from real income', async () => {
    const result = await confirm(await insertPayment(1, 'sandbox'))
    const row = (
      await service('SELECT * FROM public.offerings WHERE id=$1', [
        result.offering_id,
      ])
    ).rows[0]
    assert.equal(row.status, 'test')
    assert.match(row.receipt_number, /^TEST-/)
    assert.equal(
      (
        await service(
          "SELECT count(*)::int AS n FROM public.offerings WHERE church_id=$1 AND status='completed'",
          [church]
        )
      ).rows[0].n,
      0
    )
  })
  it('prevents duplicate in-flight payments, including requests from multiple tabs', async () => {
    await insertPayment()
    await assert.rejects(insertPayment(2), /giving_one_pending_per_member/i)
  })
  it('keeps requested amounts and payment identities immutable', async () => {
    const payment = await insertPayment()
    await assert.rejects(
      service('UPDATE public.giving_payments SET amount=1 WHERE id=$1', [
        payment.id,
      ]),
      /cannot be changed/i
    )
    await assert.rejects(
      service(
        "UPDATE public.giving_payments SET checkout_request_id='another' WHERE id=$1",
        [payment.id]
      ),
      /cannot be changed/i
    )
    await confirm(payment)
    await assert.rejects(
      service("UPDATE public.giving_payments SET status='failed' WHERE id=$1", [
        payment.id,
      ]),
      /cannot be changed/i
    )
  })
  it('restricts member receipts to their own church membership and finance history to authorized admins', async () => {
    await confirm(await insertPayment())
    for (const [user, expected] of [
      [admin, 1],
      [member, 1],
      [peer, 0],
      [outsider, 0],
      [inactive, 0],
      [deptAdmin, 0],
    ]) {
      assert.equal(
        (
          await queryAs(
            user,
            'SELECT * FROM public.offerings WHERE church_id=$1',
            [church]
          )
        ).rows.length,
        expected
      )
    }
    await service(
      "UPDATE public.role_permissions SET permissions = array['finance:read'] WHERE church_id=$1 AND role='dept_admin'",
      [church]
    )
    assert.equal(
      (
        await queryAs(
          deptAdmin,
          'SELECT * FROM public.offerings WHERE church_id=$1',
          [church]
        )
      ).rows.length,
      1
    )
    await assert.rejects(
      queryAs(
        deptAdmin,
        'INSERT INTO public.offerings(church_id, amount) VALUES ($1,100)',
        [church]
      ),
      /row-level security/i
    )
  })
  it('does not allow authenticated callers to forge or edit an online receipt', async () => {
    const payment = await insertPayment(),
      confirmed = await confirm(payment)
    await assert.rejects(
      queryAs(
        admin,
        'INSERT INTO public.offerings(church_id,amount,payment_id) VALUES ($1,999,$2)',
        [church, payment.id]
      ),
      /row-level security/i
    )
    const changed = await queryAs(
      admin,
      'UPDATE public.offerings SET amount=1 WHERE id=$1 RETURNING id',
      [confirmed.offering_id]
    )
    assert.equal(changed.rows.length, 0)
  })
  it('issues receipts for all giving categories, including anonymous manual giving', async () => {
    for (const type of [
      'general',
      'tithe',
      'missions',
      'building_fund',
      'project_fund',
      'thanksgiving',
      'welfare',
      'other',
    ]) {
      const row = (
        await queryAs(
          admin,
          'INSERT INTO public.offerings(church_id, amount, type) VALUES ($1,100,$2) RETURNING *',
          [church, type]
        )
      ).rows[0]
      assert.match(row.receipt_number, /^RCP-/)
      assert.equal(row.receipt_details.donor.full_name, 'Anonymous')
    }
    await assert.rejects(
      queryAs(
        admin,
        'INSERT INTO public.offerings(church_id, membership_id, amount) VALUES ($1,$2,100)',
        [church, id(1004)]
      ),
      /must belong to this church/i
    )
    await assert.rejects(
      queryAs(
        admin,
        'INSERT INTO public.offerings(church_id, amount) VALUES ($1,0)',
        [church]
      ),
      /must be positive/i
    )
  })
  it('does not truncate receipt numbers when the sequence exceeds six digits', async () => {
    await service("SELECT setval('public.receipt_number_seq',999999,true)")
    const row = (
      await queryAs(
        admin,
        'INSERT INTO public.offerings(church_id, amount) VALUES ($1,100) RETURNING receipt_number',
        [church]
      )
    ).rows[0]
    assert.match(row.receipt_number, /-1000000$/)
  })
  it('keeps receipt details after membership removal and allows complete church deletion', async () => {
    const payment = await confirm(await insertPayment())
    await service('DELETE FROM public.church_memberships WHERE id=$1', [
      id(1002),
    ])
    const row = (
      await service('SELECT * FROM public.offerings WHERE id=$1', [
        payment.offering_id,
      ])
    ).rows[0]
    assert.equal(row.membership_id, null)
    assert.equal(row.receipt_details.donor.full_name, 'Giving Member')
    await service('DELETE FROM public.churches WHERE id=$1', [church])
    await service('SET CONSTRAINTS ALL IMMEDIATE')
    assert.equal(
      (
        await service(
          'SELECT count(*)::int AS n FROM public.giving_payments WHERE church_id=$1',
          [church]
        )
      ).rows[0].n,
      0
    )
  })
})
