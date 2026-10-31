import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { asUser, createTestDatabase } from './helpers/supabase-test-db.mjs'

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const church = id(100),
  otherChurch = id(200)
const admin = id(1),
  member = id(2),
  peer = id(3),
  outsider = id(4),
  inactive = id(5),
  departmentAdmin = id(6)
const membership = (n) => id(1000 + n)
let db
const act = (user, fn) => asUser(db, user, fn)
const queryAs = (user, sql, params = []) =>
  act(user, () => db.query(sql, params))
const createActivity = (extra = {}) =>
  queryAs(
    admin,
    `
  INSERT INTO public.volunteer_shifts(church_id, title, location, starts_at, ends_at, recurrence, recurrence_until, slots, is_active)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      church,
      extra.title ?? 'Church cleaning',
      extra.location === undefined ? 'Main sanctuary' : extra.location,
      extra.start ?? new Date(Date.now() + 86400000).toISOString(),
      extra.end ?? new Date(Date.now() + 90000000).toISOString(),
      extra.recurrence ?? 'none',
      extra.until ?? null,
      extra.slots ?? null,
      extra.active ?? true,
    ]
  ).then((result) => result.rows[0])
const join = (activity, user = member, memberId = membership(2)) =>
  queryAs(
    user,
    'INSERT INTO public.volunteer_signups(shift_id, membership_id) VALUES ($1, $2) RETURNING id',
    [activity.id, memberId]
  )
const activities = (user = member, churchId = church) =>
  queryAs(user, 'SELECT * FROM public.get_volunteer_activities($1)', [
    churchId,
  ]).then((result) => result.rows)
const occurrence = (start, end, recurrence, until, zone, now) =>
  db
    .query(
      'SELECT * FROM public.volunteer_next_occurrence($1, $2, $3, $4, $5, $6)',
      [start, end, recurrence, until, zone, now]
    )
    .then((result) => result.rows)

describe(
  'Volunteer activities with the complete PostgreSQL schema and RLS',
  { concurrency: false },
  () => {
    before(
      async () => {
        db = await createTestDatabase()
        for (let n = 1; n <= 6; n++)
          await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [
            id(n),
            `volunteer-${n}@example.test`,
          ])
        await db.query(
          "INSERT INTO public.churches(id, name, username, plan) VALUES ($1, 'Church', 'volunteer-test', 'growth'), ($2, 'Other', 'volunteer-other', 'growth')",
          [church, otherChurch]
        )
        for (const [n, role, churchId, status] of [
          [1, 'super_admin', church, 'active'],
          [2, 'member', church, 'active'],
          [3, 'member', church, 'active'],
          [4, 'super_admin', otherChurch, 'active'],
          [5, 'member', church, 'inactive'],
          [6, 'dept_admin', church, 'active'],
        ]) {
          await db.query(
            'INSERT INTO public.church_memberships(id, user_id, church_id, role, status) VALUES ($1, $2, $3, $4, $5)',
            [membership(n), id(n), churchId, role, status]
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

    it('requires a name, venue, valid times and a positive optional capacity', async () => {
      await assert.rejects(createActivity({ title: '   ' }), /volunteer_title/)
      await assert.rejects(
        createActivity({ location: null }),
        /volunteer_venue/
      )
      await assert.rejects(
        createActivity({ location: '   ' }),
        /volunteer_venue/
      )
      await assert.rejects(
        createActivity({
          start: '2099-01-01T12:00:00Z',
          end: '2099-01-01T11:00:00Z',
        }),
        /volunteer_times/
      )
      await assert.rejects(
        createActivity({ slots: -1 }),
        /participant limit|volunteer_capacity/
      )
      const activity = await createActivity()
      assert.equal(activity.slots, null)
    })

    it('lets admins create more than 50 activities and members browse every one', async () => {
      await queryAs(
        admin,
        `INSERT INTO public.volunteer_shifts(church_id, title, location, starts_at, ends_at)
      SELECT $1, 'Activity ' || n, 'Church compound', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days' FROM generate_series(1, 125) n`,
        [church]
      )
      assert.equal((await activities()).length, 125)
    })

    it('protects activity editing and private participant identities while returning accurate totals', async () => {
      const activity = await createActivity({ slots: 3 })
      await join(activity)
      await join(activity, peer, membership(3))
      const [visible] = await activities()
      assert.equal(visible.participant_count, 2)
      assert.equal(visible.my_status, 'confirmed')
      assert.ok(visible.my_signup_id)
      const own = await queryAs(
        member,
        'SELECT * FROM public.volunteer_signups WHERE shift_id = $1',
        [activity.id]
      )
      assert.equal(own.rows.length, 1)
      assert.equal(own.rows[0].membership_id, membership(2))
      const roster = await queryAs(
        admin,
        'SELECT * FROM public.volunteer_signups WHERE shift_id = $1',
        [activity.id]
      )
      assert.equal(roster.rows.length, 2)
      await assert.rejects(
        queryAs(
          member,
          "INSERT INTO public.volunteer_shifts(church_id, title, location, starts_at, ends_at) VALUES ($1, 'Not allowed', 'Church', NOW(), NOW() + INTERVAL '1 hour')",
          [church]
        ),
        /row-level security/
      )
      const edit = await queryAs(
        member,
        "UPDATE public.volunteer_shifts SET title = 'Not allowed' WHERE id = $1 RETURNING id",
        [activity.id]
      )
      assert.equal(edit.rows.length, 0)
    })

    it('enforces capacity in the database and allows cancellation then rejoining', async () => {
      const activity = await createActivity({ slots: 1 })
      await join(activity)
      await assert.rejects(
        join(activity, peer, membership(3)),
        /activity is full/
      )
      await queryAs(
        member,
        'DELETE FROM public.volunteer_signups WHERE shift_id = $1 AND membership_id = $2',
        [activity.id, membership(2)]
      )
      assert.equal((await activities())[0].participant_count, 0)
      await join(activity, peer, membership(3))
      assert.equal((await activities(peer))[0].my_status, 'confirmed')
    })

    it('prevents duplicate participation and counts only confirmed participants', async () => {
      const activity = await createActivity()
      await join(activity)
      await assert.rejects(join(activity), /unique constraint/)
      await join(activity, peer, membership(3))
      await db.query(
        "UPDATE public.volunteer_signups SET status = 'waitlist' WHERE shift_id = $1 AND membership_id = $2",
        [activity.id, membership(3)]
      )
      assert.equal((await activities())[0].participant_count, 1)
      await db.query(
        "UPDATE public.volunteer_signups SET status = 'cancelled' WHERE shift_id = $1 AND membership_id = $2",
        [activity.id, membership(2)]
      )
      assert.equal((await activities())[0].participant_count, 0)
      assert.equal((await activities())[0].my_status, 'cancelled')
    })

    it('blocks cross-church signups, forged memberships, and inactive members', async () => {
      const activity = await createActivity()
      await assert.rejects(
        join(activity, outsider, membership(4)),
        /active membership|row-level security/
      )
      await assert.rejects(
        join(activity, member, membership(3)),
        /row-level security/
      )
      await assert.rejects(
        join(activity, inactive, membership(5)),
        /active membership|row-level security/
      )
      await assert.rejects(activities(outsider), /active membership/)
      await assert.rejects(activities(inactive), /active membership/)
      await assert.rejects(activities(member, otherChurch), /active membership/)
      assert.equal(
        (
          await queryAs(
            outsider,
            'SELECT * FROM public.volunteer_shifts WHERE id = $1',
            [activity.id]
          )
        ).rows.length,
        0
      )
    })

    it('allows legacy memberships with a null status to browse, join and cancel', async () => {
      const activity = await createActivity()
      await db.query(
        'UPDATE public.church_memberships SET status = NULL WHERE id = $1',
        [membership(2)]
      )
      assert.equal((await activities()).length, 1)
      await join(activity)
      assert.equal((await activities())[0].my_status, 'confirmed')
      await queryAs(
        member,
        'DELETE FROM public.volunteer_signups WHERE shift_id = $1',
        [activity.id]
      )
      assert.equal((await activities())[0].participant_count, 0)
    })

    it('keeps read-only department admins from editing activities or removing participants', async () => {
      const activity = await createActivity()
      await join(activity)
      const roster = await queryAs(
        departmentAdmin,
        'SELECT * FROM public.volunteer_signups WHERE shift_id = $1',
        [activity.id]
      )
      assert.equal(roster.rows.length, 1)
      await assert.rejects(
        queryAs(
          departmentAdmin,
          "INSERT INTO public.volunteer_shifts(church_id, title, location, starts_at, ends_at) VALUES ($1, 'Not allowed', 'Church', NOW(), NOW() + INTERVAL '1 hour')",
          [church]
        ),
        /row-level security/
      )
      await assert.rejects(
        queryAs(
          departmentAdmin,
          "INSERT INTO public.volunteer_roles(church_id, name) VALUES ($1, 'Not allowed')",
          [church]
        ),
        /row-level security/
      )
      const edit = await queryAs(
        departmentAdmin,
        "UPDATE public.volunteer_shifts SET title = 'Not allowed' WHERE id = $1 RETURNING id",
        [activity.id]
      )
      assert.equal(edit.rows.length, 0)
      const removal = await queryAs(
        departmentAdmin,
        'DELETE FROM public.volunteer_signups WHERE shift_id = $1 RETURNING id',
        [activity.id]
      )
      assert.equal(removal.rows.length, 0)
      assert.equal((await activities())[0].participant_count, 1)
    })

    it('allows delegated managers to edit and remove participants while reserving activity deletion for super admins', async () => {
      const activity = await createActivity()
      await join(activity)
      await db.query(
        "UPDATE public.role_permissions SET permissions = ARRAY['volunteers:*'] WHERE church_id = $1 AND role = 'dept_admin'",
        [church]
      )
      const edit = await queryAs(
        departmentAdmin,
        "UPDATE public.volunteer_shifts SET notes = 'Bring gloves' WHERE id = $1 RETURNING id",
        [activity.id]
      )
      assert.equal(edit.rows.length, 1)
      const removal = await queryAs(
        departmentAdmin,
        'DELETE FROM public.volunteer_signups WHERE shift_id = $1 RETURNING id',
        [activity.id]
      )
      assert.equal(removal.rows.length, 1)
      const deletion = await queryAs(
        departmentAdmin,
        'DELETE FROM public.volunteer_shifts WHERE id = $1 RETURNING id',
        [activity.id]
      )
      assert.equal(deletion.rows.length, 0)
      const ownerDeletion = await queryAs(
        admin,
        'DELETE FROM public.volunteer_shifts WHERE id = $1 RETURNING id',
        [activity.id]
      )
      assert.equal(ownerDeletion.rows.length, 1)
    })

    it('hides rosters when admin access is revoked or the admin becomes inactive', async () => {
      const activity = await createActivity()
      await join(activity)
      await db.query(
        "UPDATE public.role_permissions SET permissions = '{}' WHERE church_id = $1 AND role = 'dept_admin'",
        [church]
      )
      const revoked = await queryAs(
        departmentAdmin,
        'SELECT * FROM public.volunteer_signups WHERE shift_id = $1',
        [activity.id]
      )
      assert.equal(revoked.rows.length, 0)
      await db.query(
        "UPDATE public.church_memberships SET status = 'inactive' WHERE id = $1",
        [membership(1)]
      )
      const inactiveRoster = await queryAs(
        admin,
        'SELECT * FROM public.volunteer_signups WHERE shift_id = $1',
        [activity.id]
      )
      assert.equal(inactiveRoster.rows.length, 0)
      const edit = await queryAs(
        admin,
        "UPDATE public.volunteer_shifts SET title = 'Not allowed' WHERE id = $1 RETURNING id",
        [activity.id]
      )
      assert.equal(edit.rows.length, 0)
    })

    it('rejects closed and expired activities but still permits cancellation', async () => {
      const closed = await createActivity({ active: false })
      await assert.rejects(join(closed), /closed/)
      const past = await createActivity({
        start: '2020-01-01T09:00:00Z',
        end: '2020-01-01T10:00:00Z',
      })
      await assert.rejects(join(past), /closed/)
      const activity = await createActivity()
      await join(activity)
      await queryAs(
        admin,
        'UPDATE public.volunteer_shifts SET is_active = FALSE WHERE id = $1',
        [activity.id]
      )
      await queryAs(
        member,
        'DELETE FROM public.volunteer_signups WHERE shift_id = $1',
        [activity.id]
      )
      assert.equal(
        (await activities()).find((row) => row.id === activity.id)
          .participant_count,
        0
      )
    })

    it('keeps weekly activities available after the original session with an enduring signup', async () => {
      const activity = await createActivity({
        start: '2020-01-04T06:00:00Z',
        end: '2020-01-04T08:00:00Z',
        recurrence: 'weekly',
      })
      await join(activity)
      const [visible] = await activities()
      assert.ok(new Date(visible.next_ends_at) > new Date())
      assert.equal(new Date(visible.next_starts_at).getUTCDay(), 6)
      assert.equal(visible.my_status, 'confirmed')
    })

    it('validates recurrence dates, timezone and same-day recurring sessions', async () => {
      await assert.rejects(
        createActivity({
          start: '2099-01-02T06:00:00Z',
          end: '2099-01-02T07:00:00Z',
          recurrence: 'weekly',
          until: '2099-01-01',
        }),
        /repeat until/
      )
      await assert.rejects(
        createActivity({
          start: '2099-01-02T06:00:00Z',
          end: '2099-01-03T07:00:00Z',
          recurrence: 'daily',
        }),
        /same day/
      )
      const activity = await createActivity()
      await assert.rejects(
        queryAs(
          admin,
          "UPDATE public.volunteer_shifts SET timezone = 'Not/AZone' WHERE id = $1",
          [activity.id]
        ),
        /timezone/
      )
      await assert.rejects(
        queryAs(
          admin,
          'UPDATE public.volunteer_shifts SET recurrence_until = $1 WHERE id = $2',
          ['2099-01-01', activity.id]
        ),
        /One-time activities/
      )
    })

    it('uses the original monthly date after a short month and handles leap years', async () => {
      const args = [
        '2028-01-31T06:00:00Z',
        '2028-01-31T08:00:00Z',
        'monthly',
        null,
        'Africa/Nairobi',
      ]
      const feb = await occurrence(...args, '2028-02-01T00:00:00Z')
      assert.equal(
        feb[0].next_starts_at.toISOString(),
        '2028-02-29T06:00:00.000Z'
      )
      const march = await occurrence(...args, '2028-03-01T00:00:00Z')
      assert.equal(
        march[0].next_starts_at.toISOString(),
        '2028-03-31T06:00:00.000Z'
      )
    })

    it('keeps local clock times across DST, retains in-progress sessions, and respects the inclusive final date', async () => {
      const args = [
        '2026-03-01T14:00:00Z',
        '2026-03-01T16:00:00Z',
        'weekly',
        '2026-03-08',
        'America/New_York',
      ]
      const next = await occurrence(...args, '2026-03-02T00:00:00Z')
      assert.equal(
        next[0].next_starts_at.toISOString(),
        '2026-03-08T13:00:00.000Z'
      )
      assert.equal(
        (await occurrence(...args, '2026-03-08T14:00:00Z')).length,
        1
      )
      assert.equal(
        (await occurrence(...args, '2026-03-08T15:00:00Z')).length,
        0
      )
    })

    it('prevents shrinking a capacity below confirmed participants', async () => {
      const activity = await createActivity()
      await join(activity)
      await join(activity, peer, membership(3))
      await assert.rejects(
        queryAs(
          admin,
          'UPDATE public.volunteer_shifts SET slots = 1 WHERE id = $1',
          [activity.id]
        ),
        /lower than/
      )
    })

    it('notifies participants of recurrence, instructions and closure changes', async () => {
      const activity = await createActivity({
        start: '2099-01-01T06:00:00Z',
        end: '2099-01-01T08:00:00Z',
      })
      await join(activity)
      await queryAs(
        admin,
        "UPDATE public.volunteer_shifts SET recurrence = 'weekly' WHERE id = $1",
        [activity.id]
      )
      await queryAs(
        admin,
        "UPDATE public.volunteer_shifts SET notes = 'Bring gloves' WHERE id = $1",
        [activity.id]
      )
      await queryAs(
        admin,
        'UPDATE public.volunteer_shifts SET is_active = FALSE WHERE id = $1',
        [activity.id]
      )
      const notifications = await db.query(
        "SELECT * FROM public.notifications WHERE recipient_id = $1 AND kind = 'volunteer_updated' AND source_id = $2",
        [member, activity.id]
      )
      assert.equal(notifications.rows.length, 3)
    })
  }
)
