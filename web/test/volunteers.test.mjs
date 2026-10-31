import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/lib/volunteer-signups.ts', import.meta.url),
  'utf8'
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const { changeVolunteerParticipation } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

const signup = {
  id: 'old-signup',
  shift_id: 'activity',
  membership_id: 'member',
  status: 'confirmed',
}
const participation = {
  shiftId: signup.shift_id,
  membershipId: signup.membership_id,
  signedUp: false,
  signupId: null,
}

// Exercise the real Supabase query builder against an in-memory HTTP endpoint.
function database(initial = [], failure = null) {
  let rows = structuredClone(initial)
  const requests = []
  const client = createClient('https://volunteers.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, options) => {
        const url = new URL(input)
        assert.equal(url.pathname, '/rest/v1/volunteer_signups')
        requests.push(options.method)
        if (failure?.method === options.method)
          return Response.json(
            { code: failure.code, message: failure.message },
            { status: 400 }
          )
        if (options.method === 'DELETE') {
          const filters = [...url.searchParams].filter(
            ([key]) => key !== 'select'
          )
          rows = rows.filter(
            (row) =>
              !filters.every(([key, value]) => value === `eq.${row[key]}`)
          )
          return Response.json([])
        }
        assert.equal(options.method, 'POST')
        const payload = JSON.parse(options.body)
        if (
          rows.some(
            (row) =>
              row.shift_id === payload.shift_id &&
              row.membership_id === payload.membership_id
          )
        )
          return Response.json(
            { code: '23505', message: 'Duplicate signup' },
            { status: 409 }
          )
        const created = { ...payload, id: 'new-signup' }
        rows.push(created)
        return Response.json(created, { status: 201 })
      },
    },
  })
  return { client, requests, rows: () => rows }
}

test('joining, cancelling and rejoining persist the expected participation', async () => {
  const db = database()
  await changeVolunteerParticipation(db.client, participation)
  assert.equal(db.rows().length, 1)
  assert.equal(db.rows()[0].status, 'confirmed')
  await changeVolunteerParticipation(db.client, {
    ...participation,
    signedUp: true,
    signupId: db.rows()[0].id,
  })
  assert.equal(db.rows().length, 0)
  await changeVolunteerParticipation(db.client, participation)
  assert.equal(db.rows().length, 1)
})

test('a previously cancelled signup can be replaced with confirmed participation', async () => {
  const db = database([{ ...signup, status: 'cancelled' }])
  await changeVolunteerParticipation(db.client, {
    ...participation,
    signupId: signup.id,
  })
  assert.equal(db.rows().length, 1)
  assert.equal(db.rows()[0].id, 'new-signup')
  assert.equal(db.rows()[0].status, 'confirmed')
})

test('rejoining from a stale page never deletes a newer or reactivated signup', async () => {
  for (const current of [signup, { ...signup, id: 'newer-signup' }]) {
    const db = database([current])
    await assert.rejects(
      changeVolunteerParticipation(db.client, {
        ...participation,
        signupId: signup.id,
      }),
      { code: '23505' }
    )
    assert.deepEqual(db.rows(), [current])
  }
})

test('cancelling from a stale page preserves a newer signup and other members', async () => {
  const current = [
    { ...signup, id: 'newer-signup' },
    { ...signup, id: 'peer-signup', membership_id: 'peer' },
  ]
  const db = database(current)
  await changeVolunteerParticipation(db.client, {
    ...participation,
    signedUp: true,
    signupId: signup.id,
  })
  assert.deepEqual(db.rows(), current)
})

test('a failed cancellation is shown without attempting to rejoin', async () => {
  const db = database([signup], {
    method: 'DELETE',
    code: '42501',
    message: 'Permission denied',
  })
  await assert.rejects(
    changeVolunteerParticipation(db.client, {
      ...participation,
      signedUp: true,
      signupId: signup.id,
    }),
    { message: 'Permission denied' }
  )
  assert.deepEqual(db.requests, ['DELETE'])
  assert.deepEqual(db.rows(), [signup])
})

test('capacity errors propagate without creating participation', async () => {
  const db = database([], {
    method: 'POST',
    code: '23514',
    message: 'This activity is full',
  })
  await assert.rejects(changeVolunteerParticipation(db.client, participation), {
    message: 'This activity is full',
  })
  assert.deepEqual(db.rows(), [])
})
