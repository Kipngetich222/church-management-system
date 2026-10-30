import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { asUser, createTestDatabase } from './helpers/supabase-test-db.mjs'

const id = (value) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const church = id(100)
const otherChurch = id(200)
const admin = id(1)
const member = id(2)
const peer = id(3)
const outsider = id(4)
const assignee = id(5)
const deptAdmin = id(6)
const membership = (value) => id(1000 + value)
let db

const act = (user, action) => asUser(db, user, action)
const feed = (
  user = member,
  churchId = church,
  limit = 50,
  unreadOnly = false,
  cursor
) =>
  act(user, async () => {
    const result = await db.query(
      'SELECT public.get_notifications($1, $2, $3, $4, $5) AS inbox',
      [
        churchId,
        limit,
        unreadOnly,
        cursor?.created_at ?? null,
        cursor?.id ?? null,
      ]
    )
    return result.rows[0].inbox
  })
const markRead = (user, notification, read = true, churchId = church) =>
  act(user, async () => {
    const result = await db.query(
      'SELECT public.set_notification_read($1, $2, $3) AS changed',
      [churchId, notification, read]
    )
    return result.rows[0].changed
  })
const announce = (title = 'Sunday update', published = true) =>
  act(admin, async () => {
    const result = await db.query(
      'INSERT INTO public.announcements(church_id, title, body, published) VALUES ($1, $2, $3, $4) RETURNING id',
      [church, title, 'The service begins at 10 am.', published]
    )
    return result.rows[0].id
  })
const event = (visibility = 'public', extra = {}) =>
  act(admin, async () => {
    const result = await db.query(
      `INSERT INTO public.events
    (church_id, title, slug, start_time, status, visibility, visibility_department_id, visibility_group_id)
    VALUES ($1, 'Sunday gathering', gen_random_uuid()::TEXT, NOW() + INTERVAL '3 days', $2, $3, $4, $5) RETURNING id`,
      [
        church,
        extra.status ?? 'published',
        visibility,
        extra.department ?? null,
        extra.group ?? null,
      ]
    )
    return result.rows[0].id
  })
const request = () =>
  act(member, async () => {
    const result = await db.query(
      `INSERT INTO public.prayer_requests
    (church_id, membership_id, type, title, body, audience, visibility, assigned_to)
    VALUES ($1, $2, 'counseling', 'Confidential title', 'Confidential personal details', 'person', 'private', $3) RETURNING id`,
      [church, membership(2), membership(5)]
    )
    return result.rows[0].id
  })

describe(
  'Dashboard notifications against PostgreSQL and the complete app schema',
  { concurrency: false },
  () => {
    before(
      async () => {
        db = await createTestDatabase()
        for (let value = 1; value <= 7; value += 1) {
          await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [
            id(value),
            `notification-${value}@example.test`,
          ])
        }
        await db.query(
          "UPDATE public.users SET category = 'men' WHERE id = $1",
          [member]
        )
        await db.query(
          "UPDATE public.users SET category = 'women' WHERE id = $1",
          [peer]
        )
        await db.query(
          "INSERT INTO public.churches(id, name, username, plan) VALUES ($1, 'Test Church', 'notification-test', 'growth'), ($2, 'Other Church', 'notification-other', 'growth')",
          [church, otherChurch]
        )
        for (const [value, role, churchId] of [
          [1, 'super_admin', church],
          [2, 'member', church],
          [3, 'member', church],
          [4, 'super_admin', otherChurch],
          [5, 'member', church],
          [6, 'dept_admin', church],
          [7, 'member', church],
        ]) {
          await db.query(
            'INSERT INTO public.church_memberships(id, church_id, user_id, role, status) VALUES ($1, $2, $3, $4, $5)',
            [
              membership(value),
              churchId,
              id(value),
              role,
              value === 7 ? 'inactive' : 'active',
            ]
          )
        }
        await db.query(
          'INSERT INTO public.church_memberships(id, church_id, user_id) VALUES ($1, $2, $3)',
          [membership(20), otherChurch, member]
        )
        await db.query(
          "INSERT INTO public.church_memberships(id, church_id, full_name, is_manual) VALUES ($1, $2, 'Manual member', TRUE)",
          [membership(99), church]
        )
        await db.exec('DELETE FROM public.notifications')
      },
      { timeout: 120_000 }
    )
    after(async () => {
      if (db) await db.close()
    })
    beforeEach(async () => {
      await db.exec('BEGIN')
    })
    afterEach(async () => {
      await db.exec('ROLLBACK')
    })

    it('publishes notification changes to the existing Realtime publication', async () => {
      const result = await db.query(
        "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'"
      )
      assert.deepEqual(
        result.rows.map((row) => row.tablename),
        ['notifications']
      )
    })

    it('delivers published announcements to active accounts in the right church, including both admin roles', async () => {
      const draft = await announce('Draft announcement', false)
      assert.equal((await feed()).items.length, 0)
      await act(admin, () =>
        db.query(
          'UPDATE public.announcements SET published = TRUE WHERE id = $1',
          [draft]
        )
      )
      for (const user of [admin, member, peer, assignee, deptAdmin]) {
        const inbox = await feed(user)
        assert.equal(inbox.unread_count, 1)
        assert.equal(inbox.items[0].source_id, draft)
        assert.equal(inbox.items[0].recipient_id, user)
      }
      assert.equal((await feed(member, otherChurch)).items.length, 0)
      assert.equal((await feed(outsider, otherChurch)).items.length, 0)
      assert.equal((await feed(id(7))).items.length, 0)
      assert.equal(
        (
          await db.query(
            'SELECT COUNT(*)::int AS count FROM public.notifications'
          )
        ).rows[0].count,
        5
      )
    })

    it('does not duplicate a publication when edited and preserves each recipient’s read state', async () => {
      const source = await announce()
      const notification = (await feed()).items[0]
      assert.equal(await markRead(member, notification.id), true)
      await act(admin, () =>
        db.query(
          "UPDATE public.announcements SET published = TRUE, body = 'The service now begins at 11 am.' WHERE id = $1",
          [source]
        )
      )
      const inbox = await feed()
      assert.equal(inbox.items.length, 1)
      assert.equal(inbox.items[0].body, 'The service now begins at 11 am.')
      assert.ok(inbox.items[0].read_at)
      assert.equal(inbox.unread_count, 0)
      assert.equal((await feed(peer)).unread_count, 1)
    })

    it('blocks another user, another church, anonymous callers, forged alerts and content changes', async () => {
      await announce()
      const notification = (await feed()).items[0]
      assert.equal(await markRead(peer, notification.id), false)
      assert.equal(await markRead(admin, notification.id), false)
      assert.equal(
        await markRead(member, notification.id, true, otherChurch),
        false
      )
      await assert.rejects(feed(outsider), { code: '42501' })
      await assert.rejects(
        asUser(
          db,
          null,
          () => db.query('SELECT * FROM public.notifications'),
          'anon'
        ),
        { code: '42501' }
      )
      await assert.rejects(
        asUser(
          db,
          null,
          () => db.query('SELECT public.get_notifications($1)', [church]),
          'anon'
        ),
        { code: '42501' }
      )
      await assert.rejects(
        act(member, () =>
          db.query(
            "UPDATE public.notifications SET title = 'Forged' WHERE id = $1",
            [notification.id]
          )
        ),
        { code: '42501' }
      )
      await assert.rejects(
        act(member, () =>
          db.query(
            'UPDATE public.notifications SET recipient_id = $1 WHERE id = $2',
            [peer, notification.id]
          )
        ),
        { code: '42501' }
      )
      await assert.rejects(
        act(member, () =>
          db.query(
            'INSERT INTO public.notifications SELECT * FROM public.notifications LIMIT 1'
          )
        ),
        { code: '42501' }
      )
      await assert.rejects(
        act(member, () =>
          db.query(
            "SELECT public.deliver_notification($1, 'message', 'messages', $2, 'forged', 'Forged', 'Forged')",
            [church, id(999)]
          )
        ),
        { code: '42501' }
      )
      assert.equal((await feed()).unread_count, 1)
    })

    it('persists read/unread state and keeps newly arriving notifications unread after mark-all', async () => {
      await announce('First')
      const first = (await feed()).items[0]
      await markRead(member, first.id)
      assert.equal((await feed(member, church, 50, true)).items.length, 0)
      await markRead(member, first.id, false)
      const snapshot = (await feed()).snapshot_at
      await announce('Arrived later')
      await db.query(
        "UPDATE public.notifications SET created_at = $1::timestamptz + INTERVAL '1 second' WHERE title = 'Announcement: Arrived later'",
        [snapshot]
      )
      const updated = await act(member, () =>
        db.query('SELECT public.mark_all_notifications_read($1, $2) AS count', [
          church,
          snapshot,
        ])
      )
      assert.equal(updated.rows[0].count, 1)
      const remaining = await feed(member, church, 50, true)
      assert.equal(remaining.unread_count, 1)
      assert.equal(remaining.items[0].title, 'Announcement: Arrived later')
      assert.equal((await feed(peer)).unread_count, 2)
    })

    it('paginates identical timestamps without duplicates and validates cursor pairs and limits', async () => {
      for (let index = 0; index < 12; index += 1)
        await announce(`Message ${index}`)
      const first = await feed(member, church, 5)
      const second = await feed(member, church, 5, false, first.items.at(-1))
      const third = await feed(member, church, 5, false, second.items.at(-1))
      assert.equal(
        new Set(
          [...first.items, ...second.items, ...third.items].map((row) => row.id)
        ).size,
        12
      )
      assert.equal(first.unread_count, 12)
      assert.equal(first.has_more, true)
      assert.equal(second.has_more, true)
      assert.equal(third.has_more, false)
      assert.equal(third.items.length, 2)
      await assert.rejects(feed(member, church, 51), { code: '22023' })
      await assert.rejects(
        act(member, () =>
          db.query(
            'SELECT public.get_notifications($1, 20, FALSE, NOW(), NULL)',
            [church]
          )
        ),
        { code: '22023' }
      )
    })

    it('withdraws unpublished content and deletes retained copies when a source is deleted', async () => {
      const source = await announce()
      await act(admin, () =>
        db.query(
          'UPDATE public.announcements SET published = FALSE WHERE id = $1',
          [source]
        )
      )
      assert.equal((await feed()).items.length, 0)
      await act(admin, () =>
        db.query(
          'UPDATE public.announcements SET published = TRUE WHERE id = $1',
          [source]
        )
      )
      assert.equal((await feed()).items.length, 1)
      await act(admin, () =>
        db.query('DELETE FROM public.announcements WHERE id = $1', [source])
      )
      assert.equal(
        (
          await db.query(
            'SELECT COUNT(*)::int AS count FROM public.notifications'
          )
        ).rows[0].count,
        0
      )
    })

    it('targets event audiences and revokes notifications when visibility changes', async () => {
      await event('public', { status: 'draft' })
      assert.equal((await feed()).items.length, 0)
      const source = await event('men')
      assert.equal((await feed()).items.length, 1)
      assert.equal((await feed(peer)).items.length, 0)
      assert.equal((await feed(deptAdmin)).items.length, 1)
      await act(admin, () =>
        db.query(
          "UPDATE public.events SET visibility = 'super_admins' WHERE id = $1",
          [source]
        )
      )
      assert.equal((await feed()).items.length, 0)
      await event('women')
      assert.equal((await feed(peer)).items.length, 1)
      assert.equal((await feed(member, otherChurch)).items.length, 0)
    })

    it('delivers department and group event alerts only to the matching audience', async () => {
      await db.query(
        "INSERT INTO public.departments(id, church_id, name) VALUES ($1, $2, 'Choir')",
        [id(300), church]
      )
      await db.query(
        'INSERT INTO public.department_members(department_id, membership_id) VALUES ($1, $2)',
        [id(300), membership(2)]
      )
      await db.query(
        "INSERT INTO public.small_groups(id, church_id, name) VALUES ($1, $2, 'Home group')",
        [id(400), church]
      )
      await db.query(
        'INSERT INTO public.small_group_members(group_id, membership_id) VALUES ($1, $2)',
        [id(400), membership(3)]
      )
      const departmentEvent = await event('department', { department: id(300) })
      const groupEvent = await event('group', { group: id(400) })
      assert.deepEqual(
        (await feed()).items.map((row) => row.source_id),
        [departmentEvent]
      )
      assert.deepEqual(
        (await feed(peer)).items.map((row) => row.source_id),
        [groupEvent]
      )
      await db.query(
        'DELETE FROM public.department_members WHERE membership_id = $1',
        [membership(2)]
      )
      assert.equal((await feed()).items.length, 0)
    })

    it('notifies event changes and cancellations once and lets church members open a cancelled public event', async () => {
      const source = await event()
      await act(admin, () =>
        db.query(
          "UPDATE public.events SET location_name = 'Main hall' WHERE id = $1",
          [source]
        )
      )
      await act(admin, () =>
        db.query(
          "UPDATE public.events SET location_name = 'Main hall' WHERE id = $1",
          [source]
        )
      )
      await act(admin, () =>
        db.query(
          "UPDATE public.events SET status = 'cancelled' WHERE id = $1",
          [source]
        )
      )
      const inbox = await feed()
      assert.deepEqual(inbox.items.map((row) => row.kind).sort(), [
        'event_cancelled',
        'event_published',
        'event_updated',
      ])
      const visible = await act(member, () =>
        db.query('SELECT id FROM public.events WHERE id = $1', [source])
      )
      assert.equal(visible.rows.length, 1)
      const hidden = await asUser(
        db,
        null,
        () => db.query('SELECT id FROM public.events WHERE id = $1', [source]),
        'anon'
      )
      assert.equal(hidden.rows.length, 0)
    })

    it('notifies prayer assignments, public replies and status changes without copying private content', async () => {
      const source = await request()
      assert.equal((await feed(peer)).items.length, 0)
      assert.equal((await feed(assignee)).items[0].kind, 'prayer_assigned')
      assert.equal((await feed(admin)).items[0].kind, 'prayer_created')
      await act(admin, () =>
        db.query(
          'INSERT INTO public.prayer_interactions(request_id, author_membership_id, body, is_internal) VALUES ($1, $2, $3, TRUE)',
          [source, membership(1), 'Internal pastoral details']
        )
      )
      assert.equal((await feed()).items.length, 0)
      await act(assignee, () =>
        db.query(
          'INSERT INTO public.prayer_interactions(request_id, author_membership_id, body) VALUES ($1, $2, $3)',
          [source, membership(5), 'Personal response']
        )
      )
      await act(admin, () =>
        db.query(
          "UPDATE public.prayer_requests SET status = 'in_progress' WHERE id = $1",
          [source]
        )
      )
      const inbox = await feed()
      assert.deepEqual(inbox.items.map((row) => row.kind).sort(), [
        'prayer_reply',
        'prayer_status',
      ])
      assert.doesNotMatch(
        JSON.stringify(inbox),
        /Confidential|Internal pastoral details|Personal response/
      )
      await act(admin, () =>
        db.query(
          'UPDATE public.prayer_requests SET assigned_to = NULL WHERE id = $1',
          [source]
        )
      )
      assert.equal((await feed(assignee)).items.length, 0)
    })

    it('routes a member’s reply to leaders and the assigned person without alerting unrelated members', async () => {
      const source = await request()
      await act(member, () =>
        db.query(
          'INSERT INTO public.prayer_interactions(request_id, author_membership_id, body) VALUES ($1, $2, $3)',
          [source, membership(2), 'An update']
        )
      )
      assert.equal(
        (await feed(assignee)).items.filter(
          (row) => row.kind === 'prayer_reply'
        ).length,
        1
      )
      assert.equal(
        (await feed(admin)).items.filter((row) => row.kind === 'prayer_reply')
          .length,
        1
      )
      assert.equal((await feed(peer)).items.length, 0)
    })

    it('skips manual recipients, welcomes linked accounts and hides admin alerts after demotion', async () => {
      await db.query(
        "INSERT INTO public.church_memberships(id, church_id, full_name, is_manual) VALUES ($1, $2, 'New manual member', TRUE)",
        [membership(98), church]
      )
      assert.equal((await feed()).items.length, 0)
      const adminAlert = (await feed(deptAdmin)).items[0]
      assert.equal(adminAlert.kind, 'member_joined')
      await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [
        id(8),
        'new-notification-user@example.test',
      ])
      await db.query(
        'UPDATE public.church_memberships SET user_id = $1 WHERE id = $2',
        [id(8), membership(98)]
      )
      assert.equal((await feed(id(8))).items[0].kind, 'membership_welcome')
      await db.query(
        "UPDATE public.church_memberships SET role = 'member' WHERE id = $1",
        [membership(6)]
      )
      assert.equal(
        (await feed(deptAdmin)).items.some((row) => row.id === adminAlert.id),
        false
      )
      assert.equal(await markRead(deptAdmin, adminAlert.id), false)
      assert.equal((await feed(deptAdmin)).items[0].kind, 'role_changed')
    })

    it('delivers published sermons and downloadable resources through their actual triggers', async () => {
      await act(admin, () =>
        db.query(
          "INSERT INTO public.sermons(church_id, title, youtube_id, preached_at) VALUES ($1, 'Sunday sermon', 'abc12345678', CURRENT_DATE)",
          [church]
        )
      )
      const path = `${church}/guide.pdf`
      await db.query(
        'INSERT INTO storage.objects(bucket_id, name, metadata) VALUES (\'church-resources\', $1, \'{"size":100,"mimetype":"application/pdf"}\')',
        [path]
      )
      await act(admin, () =>
        db.query(
          "INSERT INTO public.resources(church_id, name, type, file_path, file_name) VALUES ($1, 'Study guide', 'document', $2, 'guide.pdf')",
          [church, path]
        )
      )
      assert.deepEqual((await feed()).items.map((row) => row.kind).sort(), [
        'resource',
        'sermon',
      ])
    })

    it('confirms volunteer signups and sends schedule changes only to volunteers on the shift', async () => {
      const created = await act(admin, () =>
        db.query(
          "INSERT INTO public.volunteer_shifts(church_id, title, starts_at, ends_at) VALUES ($1, 'Welcome team', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days') RETURNING id",
          [church]
        )
      )
      const shift = created.rows[0].id
      await act(member, () =>
        db.query(
          'INSERT INTO public.volunteer_signups(shift_id, membership_id) VALUES ($1, $2)',
          [shift, membership(2)]
        )
      )
      await act(admin, () =>
        db.query(
          "UPDATE public.volunteer_shifts SET location = 'South entrance' WHERE id = $1",
          [shift]
        )
      )
      assert.deepEqual((await feed()).items.map((row) => row.kind).sort(), [
        'volunteer_signup',
        'volunteer_updated',
      ])
      assert.equal((await feed(peer)).items.length, 0)
    })

    it('mirrors successful messages once and ignores failures and mismatched churches', async () => {
      const created = await db.query(
        "INSERT INTO public.messages(church_id, membership_id, to_address, body, channel, status) VALUES ($1, $2, 'recipient@example.test', 'Church message', 'email', 'queued') RETURNING id",
        [church, membership(2)]
      )
      const message = created.rows[0].id
      assert.equal((await feed()).items.length, 0)
      await db.query(
        "UPDATE public.messages SET status = 'failed' WHERE id = $1",
        [message]
      )
      assert.equal((await feed()).items.length, 0)
      await db.query(
        "UPDATE public.messages SET status = 'sent' WHERE id = $1",
        [message]
      )
      await db.query(
        "UPDATE public.messages SET status = 'delivered' WHERE id = $1",
        [message]
      )
      assert.equal((await feed()).items.length, 1)
      await db.query(
        "INSERT INTO public.messages(church_id, membership_id, to_address, body, status) VALUES ($1, $2, 'recipient@example.test', 'Wrong church', 'sent')",
        [otherChurch, membership(2)]
      )
      assert.equal((await feed(member, otherChurch)).items.length, 0)
    })

    it('notifies every volunteer status transition and cancellation by deleting a signup', async () => {
      const {
        rows: [shift],
      } = await db.query(
        "INSERT INTO public.volunteer_shifts(church_id, title, starts_at, ends_at) VALUES ($1, 'Welcome team', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days') RETURNING id",
        [church]
      )
      const {
        rows: [signup],
      } = await act(member, () =>
        db.query(
          'INSERT INTO public.volunteer_signups(shift_id, membership_id) VALUES ($1, $2) RETURNING id',
          [shift.id, membership(2)]
        )
      )
      for (const status of ['cancelled', 'confirmed', 'confirmed']) {
        await db.query(
          'UPDATE public.volunteer_signups SET status = $1 WHERE id = $2',
          [status, signup.id]
        )
      }
      const inbox = await feed()
      assert.equal(inbox.items.length, 3)
      assert.equal(
        inbox.items.filter((row) => row.body === 'Your signup is confirmed.')
          .length,
        2
      )
      await act(member, () =>
        db.query('DELETE FROM public.volunteer_signups WHERE id = $1', [
          signup.id,
        ])
      )
      assert.equal((await feed()).items.length, 4)
      assert.equal(
        (await feed()).items.filter(
          (row) => row.body === 'Your signup is cancelled.'
        ).length,
        2
      )
      assert.equal((await feed(peer)).items.length, 0)
      await act(member, () =>
        db.query(
          'INSERT INTO public.volunteer_signups(shift_id, membership_id) VALUES ($1, $2)',
          [shift.id, membership(2)]
        )
      )
      await db.query('DELETE FROM public.volunteer_shifts WHERE id = $1', [
        shift.id,
      ])
      assert.equal((await feed()).items.length, 0)
    })

    it('keeps resolved prayer alerts readable for owners and assignees without exposing them to other members', async () => {
      const source = await request()
      await act(admin, () =>
        db.query(
          "UPDATE public.prayer_requests SET status = 'closed' WHERE id = $1",
          [source]
        )
      )
      for (const user of [member, assignee]) {
        const { rows } = await act(user, () =>
          db.query(
            'SELECT id FROM public.prayer_requests WHERE id = $1 AND church_id = $2',
            [source, church]
          )
        )
        assert.equal(rows.length, 1)
      }
      assert.equal((await feed()).items[0].kind, 'prayer_status')
      const { rows } = await act(peer, () =>
        db.query(
          'SELECT id FROM public.prayer_requests WHERE id = $1 AND church_id = $2',
          [source, church]
        )
      )
      assert.equal(rows.length, 0)
      assert.equal((await feed(peer)).items.length, 0)
    })

    it('delivers in-app message content and campaign subject only to the intended member', async () => {
      const {
        rows: [campaign],
      } = await db.query(
        "INSERT INTO public.message_campaigns(church_id, channel, subject, body) VALUES ($1, 'in_app', 'Personal update', 'Full message') RETURNING id",
        [church]
      )
      await db.query(
        "INSERT INTO public.messages(church_id, campaign_id, membership_id, to_address, body, channel, status) VALUES ($1, $2, $3, $4, 'Full message', 'in_app', 'sent')",
        [church, campaign.id, membership(2), member]
      )
      const inbox = await feed()
      assert.equal(inbox.items.length, 1)
      assert.equal(inbox.items[0].title, 'Personal update')
      assert.equal(inbox.items[0].body, 'Full message')
      assert.equal((await feed(peer)).items.length, 0)
    })

    it('removes a departing member’s notifications without affecting their other church', async () => {
      await announce()
      await act(outsider, () =>
        db.query(
          "INSERT INTO public.announcements(church_id, title, body) VALUES ($1, 'Other church', 'Other church update')",
          [otherChurch]
        )
      )
      await db.query('DELETE FROM public.church_memberships WHERE id = $1', [
        membership(2),
      ])
      assert.equal(
        (
          await db.query(
            'SELECT COUNT(*)::int AS count FROM public.notifications WHERE recipient_id = $1 AND church_id = $2',
            [member, church]
          )
        ).rows[0].count,
        0
      )
      assert.equal((await feed(member, otherChurch)).items.length, 1)
      await assert.rejects(feed(), { code: '42501' })
    })
  }
)
