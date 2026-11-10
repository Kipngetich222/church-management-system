import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { asUser, createTestDatabase } from './helpers/supabase-test-db.mjs'

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const church = id(100),
  other = id(200),
  admin = id(1),
  peer = id(2),
  dept = id(3),
  member = id(4),
  outsider = id(5),
  inactive = id(6)
let db
const as = (user, sql, args = []) =>
  asUser(db, user, () => db.query(sql, args), user ? 'authenticated' : 'anon')
async function attempt(work) {
  await db.exec('SAVEPOINT communication_query')
  try {
    const result = await work()
    await db.exec('RELEASE SAVEPOINT communication_query')
    return result
  } catch (error) {
    await db.exec(
      'ROLLBACK TO SAVEPOINT communication_query; RELEASE SAVEPOINT communication_query'
    )
    throw error
  }
}
const resolve = (filter, actor = admin, c = church) =>
  attempt(() =>
    db.query('SELECT public.communication_recipients($1,$2,$3) AS value', [
      c,
      actor,
      JSON.stringify(filter),
    ])
  ).then((r) => r.rows[0].value)
async function fund(credits = 10, environment = 'sandbox', n = 1) {
  const purchase = id(4000 + n),
    checkout = `checkout-${n}`
  await db.query(
    "INSERT INTO sms_purchases(id,church_id,environment,request_id,credits,amount_kes,phone,status,checkout_id,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,$5,'254712345678','pending',$6,$7,'Admin')",
    [purchase, church, environment, id(5000 + n), credits, checkout, admin]
  )
  await db.query('SELECT confirm_sms_purchase($1,$2,$3)', [
    purchase,
    checkout,
    `receipt-${n}`,
  ])
  return purchase
}
async function campaign({
  n = 1,
  creator = admin,
  status = 'queued',
  environment = 'sandbox',
  channel = 'sms',
  filter = { type: 'all', ids: [] },
} = {}) {
  return (
    await db.query(
      "INSERT INTO message_campaigns(id,church_id,created_by,created_by_name,channel,body,status,sms_environment,recipient_filter,scheduled_at) VALUES($1,$2,$3,'Admin',$4,'Hello',$5,$6,$7,CASE WHEN $5 = 'scheduled' THEN now()+interval '1 day' ELSE NULL END) RETURNING *",
      [
        id(6000 + n),
        church,
        creator,
        channel,
        status,
        environment,
        JSON.stringify(filter),
      ]
    )
  ).rows[0]
}
const claim = (c) =>
  db
    .query('SELECT claim_message_campaign($1,$2) AS value', [
      c.id,
      c.sms_environment,
    ])
    .then((r) => r.rows[0].value)
const prepare = (
  c,
  rows = [
    {
      membership_id: id(1004),
      recipient_name: 'Member',
      to_address: '+254712345678',
      status: 'sending',
      error: null,
    },
  ],
  parts = 1
) =>
  attempt(() =>
    db.query('SELECT prepare_message_campaign($1,$2,$3) AS value', [
      c.id,
      JSON.stringify(rows),
      parts,
    ])
  ).then((r) => r.rows[0].value)
const settle = (c, rows) =>
  db.query('SELECT settle_message_batch($1,$2)', [c.id, JSON.stringify(rows)])
const wallet = () =>
  db
    .query(
      "SELECT purchased,available,used,reserved FROM sms_wallets WHERE church_id=$1 AND environment='sandbox'",
      [church]
    )
    .then((r) =>
      Object.fromEntries(
        Object.entries(r.rows[0]).map(([k, v]) => [k, Number(v)])
      )
    )

describe(
  'Communication credits, permissions and scheduling against the full schema',
  { concurrency: false },
  () => {
    before(
      async () => {
        db = await createTestDatabase()
        for (let n = 1; n <= 8; n++)
          await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [
            id(n),
            `sms-${n}@example.test`,
          ])
        await db.query(
          "INSERT INTO churches(id,name,username,plan) VALUES($1,'Church','sms-church','growth'),($2,'Other','sms-other','growth')",
          [church, other]
        )
        for (const [n, role, c, status, category] of [
          [1, 'super_admin', church, 'active', 'men'],
          [2, 'super_admin', church, 'active', 'women'],
          [3, 'dept_admin', church, 'active', 'men'],
          [4, 'member', church, 'active', 'youth'],
          [5, 'super_admin', other, 'active', 'men'],
          [6, 'super_admin', church, 'inactive', 'men'],
          [7, 'member', church, 'active', 'women'],
          [8, 'member', church, 'inactive', 'youth'],
        ]) {
          await db.query(
            'INSERT INTO church_memberships(id,user_id,church_id,role,status,category,full_name,phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              id(1000 + n),
              id(n),
              c,
              role,
              status,
              category,
              `Person ${n}`,
              `+25471234567${n}`,
            ]
          )
        }
        await db.query(
          "INSERT INTO departments(id,church_id,name) VALUES($1,$2,'Youth'),($3,$2,'Choir'),($4,$5,'Other department')",
          [id(300), church, id(301), id(302), other]
        )
        await db.query(
          'INSERT INTO department_members(department_id,membership_id,is_leader) VALUES($1,$2,true),($1,$3,false),($4,$5,false)',
          [id(300), id(1003), id(1004), id(301), id(1007)]
        )
        await db.query(
          "INSERT INTO small_groups(id,church_id,name,leader_membership_id) VALUES($1,$2,'Group',$3)",
          [id(310), church, id(1007)]
        )
        await db.query(
          'INSERT INTO small_group_members(group_id,membership_id) VALUES($1,$2),($1,$3)',
          [id(310), id(1004), id(1007)]
        )
      },
      { timeout: 120000 }
    )
    after(async () => {
      if (db) await db.close()
    })
    beforeEach(() => db.exec('BEGIN'))
    afterEach(() => db.exec('ROLLBACK'))

    it('isolates audiences by church and excludes inactive members', async () => {
      const rows = await resolve({ type: 'all', ids: [] })
      assert.equal(rows.length, 5)
      assert(
        !rows.some((r) =>
          [id(1005), id(1006), id(1008)].includes(r.membership_id)
        )
      )
      assert.equal(
        (await resolve({ type: 'custom', ids: [id(1005)] })).length,
        0
      )
      assert.equal(
        (await resolve({ type: 'department', ids: [id(302)] })).length,
        0
      )
    })
    it('intersects every department leader selection with their leadership scope', async () => {
      assert.deepEqual(
        (await resolve({ type: 'all', ids: [] }, dept)).map(
          (r) => r.membership_id
        ),
        [id(1003), id(1004)]
      )
      assert.deepEqual(
        (await resolve({ type: 'group', ids: [id(310)] }, dept)).map(
          (r) => r.membership_id
        ),
        [id(1004)]
      )
      assert.equal(
        (await resolve({ type: 'custom', ids: [id(1007)] }, dept)).length,
        0
      )
      assert.equal(
        (await resolve({ type: 'category', ids: ['women'] }, dept)).length,
        0
      )
      assert.equal(
        (await resolve({ type: 'department', ids: [id(301)] }, dept)).length,
        0
      )
    })
    it('supports categories and church/group/department leaders', async () => {
      assert.deepEqual(
        (await resolve({ type: 'category', ids: ['youth'] })).map(
          (r) => r.membership_id
        ),
        [id(1004)]
      )
      const leaders = (await resolve({ type: 'leaders', ids: [] })).map(
        (r) => r.membership_id
      )
      assert.deepEqual(leaders, [id(1001), id(1002), id(1003), id(1007)])
    })
    it('keeps empty filters empty and rejects unauthorized actors', async () => {
      for (const type of ['department', 'group', 'custom', 'category'])
        assert.equal((await resolve({ type, ids: [] })).length, 0)
      for (const actor of [member, outsider, inactive])
        await assert.rejects(
          resolve({ type: 'all', ids: [] }, actor),
          /administrator/
        )
      await assert.rejects(resolve({ type: 'surprise', ids: [] }), /Invalid/)
    })
    it('only trusts service-confirmed purchases and credits a payment once', async () => {
      const purchase = await fund()
      await db.query('SELECT confirm_sms_purchase($1,$2,$3)', [
        purchase,
        'checkout-1',
        'receipt-1',
      ])
      assert.deepEqual(await wallet(), {
        purchased: 10,
        available: 10,
        used: 0,
        reserved: 0,
      })
      assert.equal(
        (
          await db.query(
            "SELECT count(*) FROM sms_credit_ledger WHERE kind='purchase'"
          )
        ).rows[0].count,
        1
      )
      await assert.rejects(
        as(admin, 'SELECT confirm_sms_purchase($1,$2,$3)', [
          purchase,
          'checkout-1',
          'receipt-1',
        ]),
        /permission denied/
      )
      await assert.rejects(
        as(admin, 'UPDATE sms_wallets SET available=100'),
        /permission denied/
      )
      await assert.rejects(
        as(
          admin,
          "INSERT INTO sms_credit_ledger(church_id,environment,kind,units,balance_after,actor_name) VALUES($1,'sandbox','purchase',100,100,'Me')",
          [church]
        ),
        /permission denied/
      )
    })
    it('records a delayed receipt without crediting the purchase again', async () => {
      const purchase = await fund()
      await db.query('UPDATE sms_purchases SET receipt = NULL WHERE id = $1', [
        purchase,
      ])
      await db.query('SELECT confirm_sms_purchase($1,$2,$3)', [
        purchase,
        'checkout-1',
        'late-receipt',
      ])
      assert.equal(
        (
          await db.query('SELECT receipt FROM sms_purchases WHERE id=$1', [
            purchase,
          ])
        ).rows[0].receipt,
        'late-receipt'
      )
      assert.deepEqual(await wallet(), {
        purchased: 10,
        available: 10,
        used: 0,
        reserved: 0,
      })
    })

    it('shares wallet reads across church admins while blocking other users', async () => {
      await fund()
      for (const actor of [admin, peer, dept])
        assert.equal(
          (await as(actor, 'SELECT * FROM sms_wallets')).rows.length,
          1
        )
      for (const actor of [member, outsider, inactive]) {
        assert.equal(
          (await as(actor, 'SELECT * FROM sms_wallets')).rows.length,
          0
        )
        await assert.rejects(
          as(actor, "SELECT sms_usage_summary($1,'sandbox')", [church]),
          /administrator/
        )
      }
      await assert.rejects(
        as(null, 'SELECT * FROM sms_wallets'),
        /permission denied/
      )
    })
    it('cannot use sandbox purchases for live SMS', async () => {
      await fund()
      const c = await campaign({ environment: 'production' })
      await claim(c)
      await assert.rejects(prepare(c), /Insufficient/)
      assert.deepEqual(await wallet(), {
        purchased: 10,
        available: 10,
        used: 0,
        reserved: 0,
      })
    })
    it('claims each scheduled dispatch once and reserves atomically', async () => {
      await fund(2)
      const first = await campaign(),
        second = await campaign({ n: 2 })
      assert((await claim(first)).id)
      assert.equal(await claim(first), null)
      await prepare(first, undefined, 2)
      await claim(second)
      await assert.rejects(prepare(second), /Insufficient/)
      assert.equal(
        (
          await db.query('SELECT count(*) FROM messages WHERE campaign_id=$1', [
            second.id,
          ])
        ).rows[0].count,
        0
      )
      assert.deepEqual(await wallet(), {
        purchased: 2,
        available: 0,
        used: 0,
        reserved: 2,
      })
    })
    it('charges accepted recipients, releases rejected recipients and settles idempotently', async () => {
      await fund()
      const c = await campaign()
      await claim(c)
      const rows = await prepare(
        c,
        [
          {
            membership_id: id(1004),
            recipient_name: 'Youth',
            to_address: '+254712345674',
            status: 'sending',
          },
          {
            membership_id: id(1007),
            recipient_name: 'Woman',
            to_address: '+254712345677',
            status: 'sending',
          },
        ],
        2
      )
      const outcomes = [
        { id: rows[0].id, status: 'sent', provider_id: 'AT-one' },
        { id: rows[1].id, status: 'failed', error: 'Rejected' },
      ]
      await settle(c, outcomes)
      await settle(c, outcomes)
      assert.deepEqual(await wallet(), {
        purchased: 10,
        available: 8,
        used: 2,
        reserved: 0,
      })
      const result = (
        await db.query(
          'SELECT status,sent_count,failed_count,sms_units FROM message_campaigns WHERE id=$1',
          [c.id]
        )
      ).rows[0]
      assert.deepEqual(result, {
        status: 'partial',
        sent_count: 1,
        failed_count: 1,
        sms_units: 2,
      })
      const summary = (
        await as(dept, "SELECT sms_usage_summary($1,'sandbox') AS value", [
          church,
        ])
      ).rows[0].value
      assert.equal(summary.breakdown[0].units, 2)
      assert.equal(summary.breakdown[0].actor, 'Admin')
      assert(
        (
          await db.query(
            "SELECT count(*) FROM audit_logs WHERE entity_id=$1 AND action='communication.partial'",
            [c.id]
          )
        ).rows[0].count > 0
      )
    })
    it('retains credits when provider delivery is unknown', async () => {
      await fund()
      const c = await campaign()
      await claim(c)
      const [message] = await prepare(c)
      await settle(c, [
        { id: message.id, status: 'sending', error: 'Transport timeout' },
      ])
      assert.deepEqual(await wallet(), {
        purchased: 10,
        available: 9,
        used: 0,
        reserved: 1,
      })
      assert.equal(
        (
          await db.query('SELECT status FROM message_campaigns WHERE id=$1', [
            c.id,
          ])
        ).rows[0].status,
        'review'
      )
      assert.equal(await claim(c), null)
    })
    it('returns every prepared recipient beyond the API row cap', async () => {
      await fund(1200)
      const c = await campaign()
      await claim(c)
      const rows = Array.from({ length: 1001 }, (_, i) => ({
        membership_id: id(1004),
        recipient_name: `Person ${i}`,
        to_address: `+25471${String(i).padStart(7, '0')}`,
        status: 'sending',
      }))
      assert.equal((await prepare(c, rows)).length, 1001)
      assert.equal((await wallet()).reserved, 1001)
    })
    it('creates in-app notifications transactionally without SMS charges', async () => {
      const c = await campaign({ channel: 'in_app' })
      await claim(c)
      const [message] = await prepare(
        c,
        [
          {
            membership_id: id(1004),
            recipient_name: 'Member',
            to_address: member,
            status: 'sending',
          },
        ],
        0
      )
      await settle(c, [{ id: message.id, status: 'sent' }])
      const notifications = (
        await db.query('SELECT * FROM notifications WHERE source_id=$1', [
          message.id,
        ])
      ).rows
      assert.equal(notifications.length, 1)
      assert.equal(notifications[0].recipient_id, member)
      assert.equal(
        (await db.query('SELECT count(*) FROM sms_credit_ledger')).rows[0]
          .count,
        0
      )
    })
    it('allows schedule edits by creator or super admin and detects stale edits', async () => {
      const c = await campaign({ creator: dept, status: 'scheduled' })
      const args = [
        c.id,
        dept,
        c.updated_at,
        'Updated message',
        'sms',
        null,
        JSON.stringify({ type: 'department', ids: [id(300)] }),
        '2099-01-01T12:00:00Z',
        false,
      ]
      const sql =
        'SELECT edit_scheduled_message($1,$2,$3,$4,$5,$6,$7,$8,$9) AS value'
      const updated = (await db.query(sql, args)).rows[0].value
      assert.equal(updated.body, 'Updated message')
      // PostgreSQL now() is fixed in this test transaction; use an explicit stale version.
      await assert.rejects(
        attempt(() =>
          db.query(sql, [
            ...args.slice(0, 2),
            '2000-01-01T00:00:00Z',
            ...args.slice(3),
          ])
        ),
        /changed/
      )
      await assert.rejects(
        attempt(() =>
          db.query(sql, [c.id, member, updated.updated_at, ...args.slice(3)])
        ),
        /cannot edit/
      )
      const cancelled = (
        await db.query(sql, [
          c.id,
          peer,
          updated.updated_at,
          ...args.slice(3, 8),
          true,
        ])
      ).rows[0].value
      assert.equal(cancelled.status, 'cancelled')
      assert.equal(await claim(c), null)
    })
    it('prevents direct client edits and sending a future schedule early', async () => {
      const c = await campaign({ status: 'scheduled' })
      assert.equal(await claim(c), null)
      await assert.rejects(
        as(admin, "UPDATE message_campaigns SET body='Tampered' WHERE id=$1", [
          c.id,
        ]),
        /permission denied/
      )
      await assert.rejects(
        as(dept, 'DELETE FROM message_campaigns WHERE id=$1', [c.id]),
        /permission denied/
      )
    })
  }
)
