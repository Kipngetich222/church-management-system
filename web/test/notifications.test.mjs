import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

// These helpers only import types. Compile using the web app's TypeScript,
// keeping the tests runnable on Node 20 without another test toolchain.
const source = await readFile(
  new URL('../src/lib/notifications.ts', import.meta.url),
  'utf8'
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const { notificationHref, readNotification } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const sourceId = '00000000-0000-4000-8000-000000000100'
const notification = {
  id: 'notification-id',
  church_id: 'church-id',
  source_id: sourceId,
  source_type: 'announcements',
  title: 'Update',
  body: 'Original text',
  admin_only: false,
}

test('prayer alerts open the actual request, including replies and resolved requests', () => {
  for (const kind of ['prayer_assigned', 'prayer_reply', 'prayer_status']) {
    assert.equal(
      notificationHref(
        { ...notification, source_type: 'prayer_requests', kind },
        'member'
      ),
      `/member/prayer/${sourceId}`
    )
  }
})

test('notification destinations exist for members, admins and admin-only alerts', async () => {
  const routes = {
    events: ['member/events/[eventId]', 'admin/events/[eventId]'],
    sermons: ['member/sermons/[sermonId]', 'admin/sermons/[sermonId]'],
    resources: ['member/resources', 'admin/resources'],
    prayer_requests: [
      'member/prayer/[requestId]',
      'admin/prayer-requests/[requestId]',
    ],
    volunteer_shifts: ['member/volunteering', 'admin/volunteers/[shiftId]'],
  }
  for (const [source_type, paths] of Object.entries(routes)) {
    for (const [index, view] of ['member', 'admin'].entries()) {
      const path = paths[index]
      assert.equal(
        notificationHref({ ...notification, source_type }, view),
        `/${path.replace(/\[[^\]]+\]/g, sourceId)}`
      )
      await access(new URL(`../src/app/${path}/page.tsx`, import.meta.url))
    }
  }
  assert.equal(
    notificationHref(
      { ...notification, source_type: 'prayer_requests', admin_only: true },
      'member'
    ),
    `/admin/prayer-requests/${sourceId}`
  )
  assert.equal(
    notificationHref(
      {
        ...notification,
        source_type: 'church_memberships',
        kind: 'member_joined',
      },
      'member'
    ),
    `/admin/members/${sourceId}`
  )
  for (const source_type of [
    'announcements',
    'messages',
    'https://untrusted.test',
  ]) {
    assert.equal(
      notificationHref({ ...notification, source_type }, 'member'),
      null
    )
  }
})

function database() {
  let response = { data: notification, error: null }
  const filters = []
  const query = {
    select: () => query,
    eq: (column, value) => {
      filters.push([column, value])
      return query
    },
    abortSignal: () => query,
    maybeSingle: async () => response,
  }
  return {
    client: {
      from: (table) => {
        assert.equal(table, 'notifications')
        return query
      },
    },
    filters,
    respond: (data, error = null) => {
      response = { data, error }
    },
  }
}

test('message refreshes retrieve edits and remove deleted or inaccessible content', async () => {
  const db = database()
  const signal = new AbortController().signal
  const load = () =>
    readNotification(db.client, 'church-id', notification.id, signal)
  assert.equal((await load()).body, 'Original text')
  db.respond({ ...notification, body: 'Edited text' })
  assert.equal((await load()).body, 'Edited text')
  db.respond(null)
  assert.equal(await load(), null)
  assert.deepEqual(db.filters.slice(0, 2), [
    ['church_id', 'church-id'],
    ['id', notification.id],
  ])
})

test('a failed or aborted message refresh does not return an older message', async () => {
  const db = database()
  const controller = new AbortController()
  await readNotification(
    db.client,
    'church-id',
    notification.id,
    controller.signal
  )
  db.respond(null, new Error('Network unavailable'))
  await assert.rejects(
    readNotification(
      db.client,
      'church-id',
      notification.id,
      controller.signal
    ),
    /Network unavailable/
  )
  controller.abort()
  await assert.rejects(
    readNotification(
      db.client,
      'church-id',
      notification.id,
      controller.signal
    ),
    { name: 'AbortError' }
  )
})
