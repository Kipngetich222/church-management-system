import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const token = '00000000-0000-4000-8000-000000000200'
const church = '00000000-0000-4000-8000-000000000100'
const session = 'ab'.repeat(32)
const input = {
  full_name: ' Visitor Name ',
  phone: '',
  email: 'VISITOR@example.test',
  comment: 'Hello',
  registrationToken: session,
}

// Execute the actual TypeScript route handlers, validation and QR renderer.
// Only the request cookie context and Supabase transport are substituted.
function fixture({
  signedIn = true,
  allowed = true,
  cookie = session,
  failure = null,
} = {}) {
  const requests = []
  const revalidated = []
  const config = {
    church_id: church,
    token,
    welcome_message: 'Welcome!',
    created_by: 'admin',
    created_at: '2026-11-04T10:00:00Z',
  }
  const database = createClient('https://visitors.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url, options) => {
        const request = {
          url: new URL(url),
          method: options.method,
          body: options.body ? JSON.parse(options.body) : null,
        }
        requests.push(request)
        if (failure) return Response.json(failure, { status: 400 })
        if (request.url.pathname.endsWith('/rpc/is_visitor_admin'))
          return Response.json(allowed)
        if (request.url.pathname.endsWith('/rpc/ensure_visitor_portal'))
          return Response.json(config)
        if (request.url.pathname.endsWith('/visitor_portals')) {
          if (request.method === 'PATCH') Object.assign(config, request.body)
          return Response.json([config])
        }
        return Response.json(token)
      },
    },
  })
  const serverClient = {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    auth: {
      getUser: async () => ({
        data: { user: signedIn ? { id: 'admin' } : null },
        error: null,
      }),
    },
  }
  const mocks = {
    'next/headers': {
      cookies: async () => ({
        get: () => (cookie ? { value: cookie } : undefined),
      }),
    },
    'next/cache': { revalidatePath: (value) => revalidated.push(value) },
    'next/navigation': {
      redirect: () => {
        throw new Error('Redirect')
      },
    },
    '@/lib/supabase/public': { createPublicClient: () => database },
    '@/lib/supabase/server': { createClient: async () => serverClient },
    '@/lib/utils/church-scope': {
      getActiveChurch: async () => ({ churchId: church }),
    },
    '@/lib/utils/app-url': { appBaseUrl: () => 'https://church.example.test' },
  }
  const loaded = new Map()
  function load(relative) {
    const filename = path.resolve(
      sourceRoot,
      relative.endsWith('.ts') ? relative : `${relative}.ts`
    )
    if (loaded.has(filename)) return loaded.get(filename).exports
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText
    const loadedModule = { exports: {} }
    loaded.set(filename, loadedModule)
    const localRequire = (name) => {
      if (name in mocks) return mocks[name]
      if (name.startsWith('@/')) return load(name.slice(2))
      return require(name)
    }
    new Function('require', 'module', 'exports', compiled)(
      localRequire,
      loadedModule,
      loadedModule.exports
    )
    return loadedModule.exports
  }
  return { load, requests, revalidated, config }
}

const context = { params: Promise.resolve({ token, churchId: church }) }
const request = (
  suffix,
  body,
  origin = 'https://church.example.test',
  method = 'POST'
) =>
  new Request(`https://church.example.test/api/visitors/${token}/${suffix}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

test('successful registration sets a private session cookie and refreshes admin views', async () => {
  const f = fixture()
  const route = f.load('app/api/visitors/[token]/register/route')
  const response = await route.POST(request('register', input), context)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i)
  assert.match(response.headers.get('set-cookie'), /SameSite=lax/i)
  assert.match(response.headers.get('set-cookie'), /Max-Age=2592000/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(f.requests[0].body.p_full_name, 'Visitor Name')
  assert.equal(f.requests[0].body.p_email, 'visitor@example.test')
  assert.equal(f.requests[0].body.p_token, token)
  assert.equal(f.requests[0].body.p_session_token, session)
  assert.ok(f.revalidated.includes('/admin/visitors'))
  assert.ok(f.revalidated.includes('/admin/dashboard'))
})

test('failed registration never sets a session or reports success', async () => {
  const f = fixture({
    failure: { code: 'P0002', message: 'Welcome link not found' },
  })
  const response = await f
    .load('app/api/visitors/[token]/register/route')
    .POST(request('register', input), context)
  assert.equal(response.status, 404)
  assert.equal(response.headers.has('set-cookie'), false)
  assert.equal(f.revalidated.length, 0)
})

test('registration rejects invalid fields, staff-only fields and invalid links before writing', async () => {
  const f = fixture()
  const route = f.load('app/api/visitors/[token]/register/route')
  for (const extra of [
    { full_name: '  ' },
    { phone: 'invalid' },
    { email: 'invalid' },
    { notes: 'Staff note' },
    { church_id: church },
    { source: 'manual' },
    { comment: 'x'.repeat(2001) },
  ]) {
    assert.equal(
      (await route.POST(request('register', { ...input, ...extra }), context))
        .status,
      400
    )
  }
  assert.equal(
    (
      await route.POST(request('register', input), {
        params: Promise.resolve({ token: 'invalid' }),
      })
    ).status,
    404
  )
  assert.equal(f.requests.length, 0)
})

test('visitor mutations reject requests from another origin', async () => {
  const f = fixture()
  const route = f.load('app/api/visitors/[token]/register/route')
  assert.equal(
    (
      await route.POST(
        request('register', input, 'https://other.example.test'),
        context
      )
    ).status,
    403
  )
  assert.equal(f.requests.length, 0)
})

test('visitor mutations accept the configured public origin behind a reverse proxy', async () => {
  const f = fixture()
  const response = await f.load('app/api/visitors/[token]/register/route').POST(
    new Request(`http://localhost:3000/api/visitors/${token}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://church.example.test',
      },
      body: JSON.stringify(input),
    }),
    context
  )
  assert.equal(response.status, 200)
  assert.equal(f.requests.length, 1)
})

test('visitor mutations accept the browser Host when Next uses an internal hostname', async () => {
  const f = fixture()
  const response = await f.load('app/api/visitors/[token]/register/route').POST(
    new Request(`http://localhost:3107/api/visitors/${token}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: '127.0.0.1:3107',
        Origin: 'http://127.0.0.1:3107',
      },
      body: JSON.stringify(input),
    }),
    context
  )
  assert.equal(response.status, 200)
  assert.equal(f.requests.length, 1)
})

test('an untrusted forwarded host does not authorize a cross-origin visitor request', async () => {
  const f = fixture()
  const response = await f.load('app/api/visitors/[token]/register/route').POST(
    new Request(`http://localhost:3000/api/visitors/${token}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'church.example.test',
        'X-Forwarded-Host': 'other.example.test',
        Origin: 'https://other.example.test',
      },
      body: JSON.stringify(input),
    }),
    context
  )
  assert.equal(response.status, 403)
  assert.equal(f.requests.length, 0)
})

test('comment retries preserve the submission ID but edited messages get a new ID on HTTP devices', () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const getRandomValues = globalThis.crypto.getRandomValues.bind(
    globalThis.crypto
  )
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues },
  })
  try {
    const { visitorCommentSubmission, visitorCommentSchema } =
      fixture().load('lib/visitors')
    const first = visitorCommentSubmission(' Thank you! ')
    assert.equal(visitorCommentSchema.safeParse(first).success, true)
    assert.equal(first.body, 'Thank you!')
    assert.deepEqual(visitorCommentSubmission('Thank you!', first), first)
    const edited = visitorCommentSubmission('An additional question', first)
    assert.notEqual(edited.submissionId, first.submissionId)
    assert.equal(edited.body, 'An additional question')
    assert.equal(visitorCommentSchema.safeParse(edited).success, true)
  } finally {
    Object.defineProperty(globalThis, 'crypto', originalCrypto)
  }
})

test("comments use the visitor cookie and cannot substitute someone else's identity", async () => {
  const f = fixture()
  const route = f.load('app/api/visitors/[token]/comments/route')
  const response = await route.POST(
    request('comments', { body: ' Thanks! ', submissionId: token }),
    context
  )
  assert.equal(response.status, 200)
  assert.deepEqual(f.requests[0].body, {
    p_token: token,
    p_session_token: session,
    p_body: 'Thanks!',
    p_submission_id: token,
  })
  assert.equal(
    (
      await route.POST(
        request('comments', {
          body: 'Hi',
          submissionId: token,
          visitor_id: church,
        }),
        context
      )
    ).status,
    400
  )
  const noCookie = fixture({ cookie: null })
  assert.equal(
    (
      await noCookie
        .load('app/api/visitors/[token]/comments/route')
        .POST(request('comments', { body: 'Hi', submissionId: token }), context)
    ).status,
    401
  )
  assert.equal(noCookie.requests.length, 0)
})

test('expired sessions and comment rate limits are returned without success', async () => {
  for (const [code, status] of [
    ['42501', 401],
    ['P0001', 429],
  ]) {
    const f = fixture({ failure: { code, message: 'Unable to send' } })
    const response = await f
      .load('app/api/visitors/[token]/comments/route')
      .POST(request('comments', { body: 'Hi', submissionId: token }), context)
    assert.equal(response.status, status)
    if (status === 401)
      assert.equal((await response.json()).code, 'VISITOR_SESSION_EXPIRED')
    assert.equal(f.revalidated.length, 0)
  }
})

test('an expired registration token tells the form to discard it without setting a cookie', async () => {
  const f = fixture({
    failure: { code: '42501', message: 'Invalid or expired session' },
  })
  const response = await f
    .load('app/api/visitors/[token]/register/route')
    .POST(request('register', input), context)
  assert.equal(response.status, 401)
  assert.equal((await response.json()).code, 'VISITOR_SESSION_EXPIRED')
  assert.equal(response.headers.has('set-cookie'), false)
  assert.equal(f.revalidated.length, 0)
})

test('only an authenticated super admin can generate, read or edit the shared QR', async () => {
  for (const [options, status] of [
    [{ signedIn: false }, 401],
    [{ allowed: false }, 403],
  ]) {
    const f = fixture(options)
    const route = f.load('app/api/churches/[churchId]/visitors/qr/route')
    assert.equal(
      (await route.GET(request('qr', undefined, undefined, 'GET'), context))
        .status,
      status
    )
    assert.equal((await route.POST(request('qr'), context)).status, status)
    assert.equal(
      (
        await route.PATCH(
          request('qr', { welcome_message: 'Hello' }, undefined, 'PATCH'),
          context
        )
      ).status,
      status
    )
    assert.equal(
      f.requests.some((r) => !r.url.pathname.endsWith('/rpc/is_visitor_admin')),
      false
    )
  }
})

test('all super admins receive the same downloadable PNG, and welcome editing does not rotate it', async () => {
  const f = fixture()
  const route = f.load('app/api/churches/[churchId]/visitors/qr/route')
  const generated = await (await route.POST(request('qr'), context)).json()
  const viewed = await (
    await route.GET(request('qr', undefined, undefined, 'GET'), context)
  ).json()
  assert.equal(generated.url, `https://church.example.test/visit/${token}`)
  assert.equal(generated.qr_code, viewed.qr_code)
  const png = Buffer.from(generated.qr_code.split(',')[1], 'base64')
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.equal(png.readUInt32BE(16), 1000)
  const updated = await route.PATCH(
    request('qr', { welcome_message: ' A warm welcome! ' }, undefined, 'PATCH'),
    context
  )
  assert.equal(updated.status, 200)
  assert.equal((await updated.json()).token, token)
  assert.equal(f.config.welcome_message, 'A warm welcome!')
  assert.equal(
    (
      await (
        await route.GET(request('qr', undefined, undefined, 'GET'), context)
      ).json()
    ).qr_code,
    generated.qr_code
  )
})

test('switching visitors clears only the visitor session cookie', async () => {
  const f = fixture()
  const response = await f
    .load('app/api/visitors/[token]/session/route')
    .DELETE(request('session', undefined, undefined, 'DELETE'), context)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /church_visitor_/)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal(f.requests.length, 0)
})
