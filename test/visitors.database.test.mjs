import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { asUser, createTestDatabase } from './helpers/supabase-test-db.mjs'

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const church = id(100),
  otherChurch = id(200)
const admin = id(1),
  peerAdmin = id(2),
  deptAdmin = id(3),
  member = id(4),
  outsider = id(5),
  inactive = id(6)
const secret = (n) => n.toString(16).padStart(64, '0')
let db
const queryAs = (user, sql, params = []) =>
  asUser(db, user, () => db.query(sql, params), user ? 'authenticated' : 'anon')
const ensure = (user = admin, churchId = church) =>
  queryAs(user, 'SELECT * FROM public.ensure_visitor_portal($1)', [
    churchId,
  ]).then((r) => r.rows[0])
const register = (
  token,
  session = secret(1),
  name = ' A Visitor ',
  comment = 'Thank you for welcoming me!'
) =>
  queryAs(
    null,
    'SELECT public.register_church_visitor($1, $2, $3, $4, $5, $6) AS id',
    [token, name, session, '+254712345678', 'VISITOR@example.test', comment]
  ).then((r) => r.rows[0].id)
const portal = (token, session = secret(1)) =>
  queryAs(null, 'SELECT public.get_visitor_portal($1, $2) AS content', [
    token,
    session,
  ]).then((r) => r.rows[0].content)
const comment = (
  token,
  session = secret(1),
  body = 'A lovely service',
  submission = id(999)
) =>
  queryAs(null, 'SELECT public.add_visitor_comment($1, $2, $3, $4) AS id', [
    token,
    session,
    body,
    submission,
  ]).then((r) => r.rows[0].id)

describe(
  'Visitor registration, shared QR identity and privacy with the complete schema',
  { concurrency: false },
  () => {
    before(
      async () => {
        db = await createTestDatabase()
        for (let n = 1; n <= 6; n++) {
          await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [
            id(n),
            `visitor-admin-${n}@example.test`,
          ])
        }
        await db.query(
          "INSERT INTO public.churches(id, name, username, plan) VALUES ($1, 'Church', 'visitor-test', 'growth'), ($2, 'Other Church', 'visitor-other', 'growth')",
          [church, otherChurch]
        )
        for (const [n, role, churchId, status] of [
          [1, 'super_admin', church, 'active'],
          [2, 'super_admin', church, 'active'],
          [3, 'dept_admin', church, 'active'],
          [4, 'member', church, 'active'],
          [5, 'super_admin', otherChurch, 'active'],
          [6, 'super_admin', church, 'inactive'],
        ]) {
          await db.query(
            'INSERT INTO public.church_memberships(id, user_id, church_id, role, status) VALUES ($1, $2, $3, $4, $5)',
            [id(1000 + n), id(n), churchId, role, status]
          )
        }
      },
      { timeout: 120000 }
    )
    after(async () => {
      if (db) await db.close()
    })
    beforeEach(() => db.exec('BEGIN'))
    afterEach(() => db.exec('ROLLBACK'))

    it('shares one permanent token between super admins and uses different tokens for different churches', async () => {
      const first = await ensure()
      assert.deepEqual(await ensure(peerAdmin), first)
      assert.deepEqual(await ensure(), first)
      const other = await ensure(outsider, otherChurch)
      assert.notEqual(first.token, other.token)
      const rows = await queryAs(
        peerAdmin,
        'SELECT * FROM public.visitor_portals'
      )
      assert.equal(rows.rows.length, 1)
      assert.equal(rows.rows[0].token, first.token)
      await queryAs(
        peerAdmin,
        'UPDATE public.visitor_portals SET welcome_message = $1 WHERE church_id = $2',
        ['Welcome to our family!', church]
      )
      assert.equal((await ensure()).token, first.token)
      const welcome = await queryAs(
        null,
        'SELECT public.get_visitor_welcome($1) AS welcome',
        [first.token]
      )
      assert.equal(
        welcome.rows[0].welcome.welcome_message,
        'Welcome to our family!'
      )
      assert.equal(welcome.rows[0].welcome.church_name, 'Church')
    })

    it('rejects generation by members, department admins, inactive admins, anonymous users and other churches', async () => {
      for (const user of [member, deptAdmin, inactive, outsider, null]) {
        await assert.rejects(ensure(user), /super admin|permission denied/i)
      }
      await ensure()
      for (const user of [member, deptAdmin, inactive, outsider]) {
        assert.equal(
          (await queryAs(user, 'SELECT * FROM public.visitor_portals')).rows
            .length,
          0
        )
      }
      await assert.rejects(
        queryAs(null, 'SELECT * FROM public.visitor_portals'),
        /permission denied/i
      )
    })

    it('prevents replacing or deleting the shared QR code while allowing welcome edits', async () => {
      const config = await ensure()
      await assert.rejects(
        queryAs(admin, 'UPDATE public.visitor_portals SET token = $1', [
          id(123),
        ]),
        /permission denied/i
      )
      await assert.rejects(
        queryAs(admin, 'DELETE FROM public.visitor_portals'),
        /permission denied/i
      )
      await assert.rejects(
        queryAs(
          admin,
          'INSERT INTO public.visitor_portals(church_id) VALUES ($1)',
          [otherChurch]
        ),
        /permission denied/i
      )
      await assert.rejects(
        queryAs(
          admin,
          'UPDATE public.visitor_portals SET welcome_message = $1',
          [' ']
        ),
        /visitor_welcome_length/
      )
      assert.equal((await ensure(peerAdmin)).token, config.token)
    })

    it('saves manual visitors and exposes records to every active super admin of their church', async () => {
      const created = await queryAs(
        admin,
        'INSERT INTO public.visitors(church_id, full_name, email, notes) VALUES ($1, $2, $3, $4) RETURNING *',
        [
          church,
          ' Manual Visitor ',
          'MANUAL@example.test',
          'Private follow-up context',
        ]
      )
      assert.equal(created.rows[0].source, 'manual')
      assert.equal(created.rows[0].full_name, 'Manual Visitor')
      assert.equal(created.rows[0].email, 'manual@example.test')
      assert.equal(
        (await queryAs(peerAdmin, 'SELECT * FROM public.visitors')).rows.length,
        1
      )
      for (const user of [outsider, member, deptAdmin, inactive, null]) {
        assert.equal(
          (await queryAs(user, 'SELECT * FROM public.visitors')).rows.length,
          0
        )
      }
      await assert.rejects(
        queryAs(
          null,
          'INSERT INTO public.visitors(church_id, full_name) VALUES ($1, $2)',
          [church, 'Anonymous direct write']
        ),
        /row-level security/
      )
    })

    it('allows legacy super admins with a null membership status to manage visitors and follow-ups', async () => {
      await db.query(
        'UPDATE public.church_memberships SET status = NULL WHERE id = $1',
        [id(1001)]
      )
      const config = await ensure()
      assert.equal((await ensure(peerAdmin)).token, config.token)
      const created = await queryAs(
        admin,
        'INSERT INTO public.visitors(church_id, full_name) VALUES ($1, $2) RETURNING id',
        [church, 'Legacy admin visitor']
      )
      const visitorId = created.rows[0].id
      await queryAs(
        admin,
        'UPDATE public.visitors SET status = $1 WHERE id = $2',
        ['contacted', visitorId]
      )
      await queryAs(
        admin,
        'INSERT INTO public.visitor_followups(visitor_id, author_membership_id, method, notes) VALUES ($1, $2, $3, $4)',
        [visitorId, id(1001), 'call', 'Welcome call completed']
      )
      assert.equal(
        (await queryAs(peerAdmin, 'SELECT * FROM public.visitor_followups'))
          .rows.length,
        1
      )
      await queryAs(admin, 'DELETE FROM public.visitors WHERE id = $1', [
        visitorId,
      ])
      assert.equal(
        (await queryAs(peerAdmin, 'SELECT * FROM public.visitor_followups'))
          .rows.length,
        0
      )
    })

    it('validates manual contact data and rejects references to another church', async () => {
      for (const name of [' ', '\t\n', 'x'.repeat(161)]) {
        await assert.rejects(
          queryAs(
            admin,
            'INSERT INTO public.visitors(church_id, full_name) VALUES ($1, $2)',
            [church, name]
          ),
          /full name/
        )
      }
      await assert.rejects(
        queryAs(
          admin,
          'INSERT INTO public.visitors(church_id, full_name, email) VALUES ($1, $2, $3)',
          [church, 'Visitor', 'invalid']
        ),
        /email/
      )
      await assert.rejects(
        queryAs(
          admin,
          'INSERT INTO public.visitors(church_id, full_name, invited_by_membership_id) VALUES ($1, $2, $3)',
          [church, 'Visitor', id(1005)]
        ),
        /membership must belong/
      )
    })

    it('registers through a QR without an account, records the comment and deduplicates request retries', async () => {
      const { token } = await ensure()
      const visitorId = await register(token)
      assert.equal(
        await register(token, secret(1), 'An attempted replacement'),
        visitorId
      )
      const { rows } = await queryAs(peerAdmin, 'SELECT * FROM public.visitors')
      assert.equal(rows.length, 1)
      assert.equal(rows[0].full_name, 'A Visitor')
      assert.equal(rows[0].email, 'visitor@example.test')
      assert.equal(rows[0].source, 'qr')
      assert.equal(rows[0].status, 'new')
      assert.ok(rows[0].first_visit_date)
      assert.equal(
        (await queryAs(peerAdmin, 'SELECT * FROM public.visitor_comments')).rows
          .length,
        1
      )
      assert.equal(
        (await portal(token)).comments[0].body,
        'Thank you for welcoming me!'
      )
      const sessions = await db.query(
        'SELECT token_hash FROM public.visitor_sessions'
      )
      assert.notEqual(sessions.rows[0].token_hash, secret(1))
    })

    it('does not disclose visitor identities, contact information, internal notes or session secrets', async () => {
      const { token } = await ensure()
      const visitorId = await register(token)
      await queryAs(
        admin,
        'UPDATE public.visitors SET notes = $1 WHERE id = $2',
        ['Internal staff note', visitorId]
      )
      await queryAs(
        admin,
        'INSERT INTO public.visitor_followups(visitor_id, author_membership_id, notes) VALUES ($1, $2, $3)',
        [visitorId, id(1001), 'Confidential call']
      )
      await register(token, secret(2), 'Someone Else', 'Someone else comment')
      const content = await portal(token)
      assert.deepEqual(Object.keys(content.visitor), ['full_name'])
      const serialized = JSON.stringify(content)
      for (const privateText of [
        'Internal staff note',
        'Confidential call',
        'Someone Else',
        'Someone else comment',
        '+254712345678',
        'visitor@example.test',
      ]) {
        assert.equal(serialized.includes(privateText), false)
      }
      assert.equal(await portal(token, secret(99)), null)
      assert.equal(await portal(id(999), secret(1)), null)
      assert.equal(
        (await queryAs(null, 'SELECT * FROM public.visitor_followups')).rows
          .length,
        0
      )
      await assert.rejects(
        queryAs(null, 'SELECT * FROM public.visitor_comments'),
        /permission denied/
      )
      await assert.rejects(
        queryAs(admin, 'SELECT * FROM public.visitor_sessions'),
        /permission denied/
      )
    })

    it('only returns current public events and public active services from the visitor church', async () => {
      const { token } = await ensure()
      await register(token)
      for (const [n, scope, visibility, status, when] of [
        [1, church, 'public', 'published', "NOW() + INTERVAL '1 day'"],
        [2, church, 'members_only', 'published', "NOW() + INTERVAL '1 day'"],
        [3, church, 'public', 'draft', "NOW() + INTERVAL '1 day'"],
        [4, church, 'public', 'cancelled', "NOW() + INTERVAL '1 day'"],
        [5, otherChurch, 'public', 'published', "NOW() + INTERVAL '1 day'"],
        [6, church, 'public', 'published', "NOW() - INTERVAL '10 days'"],
      ]) {
        await db.query(
          `INSERT INTO public.events(id, church_id, title, slug, start_time, visibility, status) VALUES ($1, $2, $3, $3, ${when}, $4, $5)`,
          [id(300 + n), scope, `event-${n}`, visibility, status]
        )
      }
      for (const [n, scope, visibility, active] of [
        [1, church, 'public', true],
        [2, church, 'members_only', true],
        [3, church, 'public', false],
        [4, otherChurch, 'public', true],
      ]) {
        await db.query(
          'INSERT INTO public.recurring_services(id, church_id, title, day_of_week, visibility, is_active) VALUES ($1, $2, $3, 0, $4, $5)',
          [id(400 + n), scope, `service-${n}`, visibility, active]
        )
      }
      const content = await portal(token)
      assert.deepEqual(
        content.events.map((e) => e.id),
        [id(301)]
      )
      assert.deepEqual(
        content.services.map((s) => s.id),
        [id(401)]
      )
      await db.query(
        "UPDATE public.events SET visibility = 'members_only' WHERE id = $1",
        [id(301)]
      )
      await db.query(
        "UPDATE public.recurring_services SET visibility = 'members_only' WHERE id = $1",
        [id(401)]
      )
      assert.deepEqual((await portal(token)).events, [])
      assert.deepEqual((await portal(token)).services, [])
    })

    it('only permits comments from a registered visitor session and keeps retries idempotent', async () => {
      const { token } = await ensure()
      await assert.rejects(comment(token), /register before/)
      await register(token)
      const first = await comment(token)
      assert.equal(await comment(token), first)
      assert.equal((await portal(token)).comments.length, 2)
      await assert.rejects(
        comment(token, secret(1), ' \t\n', id(888)),
        /Enter a comment/
      )
      await assert.rejects(
        comment(token, secret(1), 'x'.repeat(2001), id(888)),
        /Enter a comment/
      )
      const other = await ensure(outsider, otherChurch)
      await assert.rejects(comment(other.token, secret(1)), /register before/)
      await assert.rejects(
        register(other.token, secret(1)),
        /invalid or expired/
      )
      assert.equal(
        (await queryAs(outsider, 'SELECT * FROM public.visitor_comments')).rows
          .length,
        0
      )
      assert.equal(
        (await queryAs(peerAdmin, 'SELECT * FROM public.visitor_comments')).rows
          .length,
        2
      )
    })

    it('limits comment bursts while permitting retries of already saved comments', async () => {
      const { token } = await ensure()
      await register(token, secret(1), 'Visitor', '')
      for (let n = 0; n < 10; n++)
        await comment(token, secret(1), `Comment ${n}`, id(500 + n))
      await assert.rejects(
        comment(token, secret(1), 'More', id(600)),
        /wait a few minutes/
      )
      assert.ok(await comment(token, secret(1), 'Comment 0', id(500)))
    })

    it('expires visitor access without expiring the church QR code and revokes access after record deletion', async () => {
      const { token } = await ensure()
      const visitorId = await register(token)
      await db.query(
        "UPDATE public.visitor_sessions SET expires_at = NOW() - INTERVAL '1 day'"
      )
      assert.equal(await portal(token), null)
      await assert.rejects(comment(token), /register before/)
      assert.equal((await ensure(peerAdmin)).token, token)
      await register(token, secret(2), 'A new visitor')
      assert.ok(await portal(token, secret(2)))
      await queryAs(admin, 'DELETE FROM public.visitors WHERE id = $1', [
        visitorId,
      ])
      assert.equal(
        (
          await db.query(
            'SELECT * FROM public.visitor_comments WHERE visitor_id = $1',
            [visitorId]
          )
        ).rows.length,
        0
      )
    })

    it('rejects follow-up authors from another church or another admin account', async () => {
      const { token } = await ensure()
      const visitorId = await register(token)
      for (const author of [id(1005), id(1002)]) {
        await assert.rejects(
          queryAs(
            admin,
            'INSERT INTO public.visitor_followups(visitor_id, author_membership_id, notes) VALUES ($1, $2, $3)',
            [visitorId, author, 'Wrong author']
          ),
          /author must be/
        )
      }
      await assert.rejects(
        queryAs(
          outsider,
          'INSERT INTO public.visitor_followups(visitor_id, author_membership_id, notes) VALUES ($1, $2, $3)',
          [visitorId, id(1005), 'Wrong church']
        ),
        /author must be|row-level security/
      )
    })
  }
)
