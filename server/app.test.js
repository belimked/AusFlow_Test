// Unit tests for the API, run with `npm test` (node:test, in-memory SQLite with all migrations applied).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { createApp } from './app.js'
import { hashPassword } from './auth.js'

async function setup({ mail = {} } = {}) {
  const client = createClient({ url: ':memory:' })
  for (const f of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
    const stmts = readFileSync(`migrations/${f}`, 'utf8').split('--> statement-breakpoint').map((x) => x.trim()).filter(Boolean)
    await client.batch(stmts, 'write')
  }
  const db = drizzle(client)
  const app = createApp(async (c, next) => {
    c.set('db', db)
    c.set('secret', 'test-secret')
    c.set('mail', mail)
    await next()
  })
  const call = async (method, path, body, token) => {
    const res = await app.request(`http://wasteid.test/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, body: await res.json() }
  }
  const addUser = async (id, username, password, role = 'ops', email = null) =>
    client.execute({ sql: 'INSERT INTO users (id, username, password_hash, display_name, role, email) VALUES (?, ?, ?, ?, ?, ?)', args: [id, username, await hashPassword(password), username, role, email] })
  const login = async (username, password) => call('POST', '/login', { username, password })
  return { client, call, addUser, login }
}

// Capture what would be emailed instead of calling the mail API.
function captureMail(t) {
  const sent = []
  const real = globalThis.fetch
  globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response('{}') }
  t.after(() => { globalThis.fetch = real })
  return sent
}
const MAIL = { url: 'https://mail.test', jwt: 'jwt' }

test('three wrong passwords lock the account for a while', async () => {
  const { addUser, login, client } = await setup()
  await addUser('U1', 'sam', 'right-pass')
  assert.equal((await login('sam', 'nope')).status, 401)
  assert.equal((await login('sam', 'nope')).status, 401)
  const third = await login('sam', 'nope')
  assert.equal(third.status, 423)
  assert.match(third.body.error, /locked for 15 min/)
  // Even the right password is refused while locked.
  const locked = await login('sam', 'right-pass')
  assert.equal(locked.status, 423)
  assert.match(locked.body.error, /Try again in \d+ min/)
  // Once the lock has passed, the right password works and the counter is cleared.
  await client.execute("UPDATE users SET locked_until = '2000-01-01T00:00:00.000Z' WHERE id = 'U1'")
  assert.equal((await login('sam', 'right-pass')).status, 200)
  const row = (await client.execute("SELECT failed_logins, locked_until FROM users WHERE id = 'U1'")).rows[0]
  assert.deepEqual([row.failed_logins, row.locked_until], [0, null])
})

test('a successful sign-in resets the failure count', async () => {
  const { addUser, login } = await setup()
  await addUser('U1', 'sam', 'right-pass')
  await login('sam', 'nope')
  await login('sam', 'nope')
  assert.equal((await login('sam', 'right-pass')).status, 200)
  assert.equal((await login('sam', 'nope')).status, 401)
  assert.equal((await login('sam', 'nope')).status, 401)
})

test('unknown usernames get the same 401 and lock nothing', async () => {
  const { login } = await setup()
  for (let i = 0; i < 4; i++) assert.deepEqual(await login('ghost', 'x'), { status: 401, body: { error: 'Invalid username or password' } })
})

test('an admin setting a new password lifts the lock', async () => {
  const { addUser, login, call } = await setup()
  await addUser('A1', 'boss', 'admin-pass', 'admin')
  await addUser('U1', 'sam', 'old-pass')
  for (let i = 0; i < 3; i++) await login('sam', 'nope')
  const admin = (await login('boss', 'admin-pass')).body.token
  assert.equal((await call('PATCH', '/users/U1', { password: 'new-pass' }, admin)).status, 200)
  assert.equal((await login('sam', 'new-pass')).status, 200)
})

test('forgot password emails a one-time link that resets the password', async (t) => {
  const sent = captureMail(t)
  const { addUser, call, login } = await setup({ mail: MAIL })
  await addUser('U1', 'sam', 'old-pass', 'ops', 'Sam@Example.com')
  for (let i = 0; i < 3; i++) await login('sam', 'nope')

  assert.deepEqual(await call('POST', '/password/forgot', { login: 'sam@example.com' }), { status: 200, body: { ok: true } })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].body.to_mail, 'Sam@Example.com')
  const link = /http:\/\/wasteid\.test\/#\/reset-password\?token=(\S+)/.exec(sent[0].body.content)
  assert.ok(link, sent[0].body.content)
  const token = decodeURIComponent(link[1])

  // A reset token is not a session.
  assert.equal((await call('GET', '/state', undefined, token)).status, 401)
  assert.equal((await call('POST', '/password/reset', { token, password: '123' })).status, 400)
  assert.equal((await call('POST', '/password/reset', { token, password: 'brand-new' })).status, 200)
  // Works once only, and lifted the lock.
  assert.equal((await call('POST', '/password/reset', { token, password: 'again-new' })).status, 400)
  assert.equal((await login('sam', 'brand-new')).status, 200)
})

test('forgot password gives the same answer for unknown users and users without email', async (t) => {
  const sent = captureMail(t)
  const { addUser, call } = await setup({ mail: MAIL })
  await addUser('U1', 'noemail', 'pass-123')
  assert.deepEqual(await call('POST', '/password/forgot', { login: 'ghost' }), { status: 200, body: { ok: true } })
  assert.deepEqual(await call('POST', '/password/forgot', { login: 'noemail' }), { status: 200, body: { ok: true } })
  assert.equal(sent.length, 0)
  assert.equal((await call('POST', '/password/forgot', { login: ' ' })).status, 400)
})

test('a forged or session token cannot reset a password', async () => {
  const { addUser, call, login } = await setup()
  await addUser('U1', 'sam', 'old-pass')
  const session = (await login('sam', 'old-pass')).body.token
  assert.equal((await call('POST', '/password/reset', { token: session, password: 'hijack' })).status, 400)
  assert.equal((await call('POST', '/password/reset', { token: 'abc.def', password: 'hijack' })).status, 400)
})

test('users change their own details with their current password', async () => {
  const { addUser, call, login } = await setup()
  await addUser('U1', 'sam', 'old-pass')
  const token = (await login('sam', 'old-pass')).body.token
  assert.equal((await call('PATCH', '/me', { currentPassword: 'wrong', newPassword: 'x-new-pass' }, token)).status, 403)
  assert.equal((await call('PATCH', '/me', { currentPassword: 'old-pass', email: 'not-an-email' }, token)).status, 400)
  const r = await call('PATCH', '/me', { currentPassword: 'old-pass', displayName: 'Sam Driver', email: 'sam@example.com', newPassword: 'new-pass' }, token)
  assert.equal(r.status, 200)
  assert.equal(r.body.displayName, 'Sam Driver')
  assert.equal(r.body.passwordHash, undefined)
  assert.equal(r.body.failedLogins, undefined)
  assert.equal((await login('sam', 'old-pass')).status, 401)
  assert.equal((await login('sam', 'new-pass')).status, 200)
})

test('the driver app can attach photos to pickups, offloads and transfers', async () => {
  const { addUser, call, login } = await setup()
  await addUser('U1', 'sam', 'pass-123')
  const token = (await login('sam', 'pass-123')).body.token
  const dataUrl = 'data:image/jpeg;base64,QUJD'
  for (const [type, kind] of [['pickup', 'before'], ['pickup', 'after'], ['pickup', 'photo'], ['unload', 'photo'], ['transfer', 'photo'], ['issue', 'photo']]) {
    assert.equal((await call('POST', '/photos', { type, id: 'X1', kind, dataUrl }, token)).status, 200, `${type}/${kind}`)
  }
  assert.equal((await call('POST', '/photos', { type: 'pickup', id: 'X1', kind: 'device', dataUrl }, token)).status, 400)
  assert.equal((await call('GET', '/photos?type=pickup&id=X1', undefined, token)).body.length, 3)
})

test('pickups keep the planned destination facility through /sync and /state', async () => {
  const { addUser, call, login } = await setup()
  await addUser('U1', 'sam', 'pass-123')
  const token = (await login('sam', 'pass-123')).body.token
  const pickup = { id: 'PK0001', deviceId: 'DV1', volume: 100, status: 'done', plannedFacilityId: 'FA0001' }
  assert.equal((await call('POST', '/sync', { upserts: { pickups: [pickup] }, seq: { PK: 1 } }, token)).status, 200)
  const state = (await call('GET', '/state', undefined, token)).body
  assert.equal(state.data.pickups[0].plannedFacilityId, 'FA0001')
})
