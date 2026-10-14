import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq, inArray, sql, count, getTableColumns } from 'drizzle-orm'
import * as s from './schema.js'
import { verifyPassword, signToken, verifyToken } from './auth.js'

export const TABLES = {
  companies: s.companies, locations: s.locations, devices: s.devices, drivers: s.drivers, vehicles: s.vehicles,
  facilities: s.facilities, pickups: s.pickups, transfers: s.transfers, unloads: s.unloads,
  changeLogs: s.changeLogs, importLogs: s.importLogs, alertReads: s.alertReads
}
// D1 allows at most 100 bound parameters per statement.
const MAX_PARAMS = 100

function pickColumns(table, row) {
  const out = {}
  for (const k of Object.keys(getTableColumns(table))) out[k] = row[k] ?? null
  return out
}

function chunks(table, rows) {
  const size = Math.max(1, Math.floor(MAX_PARAMS / Object.keys(getTableColumns(table)).length))
  const out = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size).map((r) => pickColumns(table, r)))
  return out
}

function upsertStatements(db, table, rows) {
  const cols = getTableColumns(table)
  const set = {}
  for (const [k, c] of Object.entries(cols)) if (k !== 'id') set[k] = sql.raw(`excluded."${c.name}"`)
  return chunks(table, rows).map((chunk) => {
    const q = db.insert(table).values(chunk)
    return Object.keys(set).length ? q.onConflictDoUpdate({ target: table.id, set }) : q.onConflictDoNothing()
  })
}

function mergeSeqStatement(db, seq) {
  return db.insert(s.meta).values({ key: 'seq', value: seq })
    .onConflictDoUpdate({ target: s.meta.key, set: { value: seq } })
}

async function readSeq(db) {
  const [row] = await db.select().from(s.meta).where(eq(s.meta.key, 'seq'))
  return row?.value || {}
}

function maxSeq(a, b) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b || {})) out[k] = Math.max(out[k] || 0, v)
  return out
}

// `setup` is a middleware that must set c.var.db (a drizzle instance with .batch) and c.var.secret.
export function createApp(setup) {
  const app = new Hono().basePath('/api')
  app.use('*', setup)

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
    console.error(err)
    return c.json({ error: 'Internal error' }, 500)
  })

  app.post('/login', async (c) => {
    const { username, password } = await c.req.json()
    const [user] = await c.var.db.select().from(s.users).where(eq(s.users.username, String(username || '')))
    if (!user || user.status !== 'active' || !(await verifyPassword(String(password || ''), user.passwordHash))) {
      throw new HTTPException(401, { message: 'Invalid username or password' })
    }
    const token = await signToken({ sub: user.id, name: user.displayName, role: user.role }, c.var.secret)
    return c.json({ token, user: { username: user.username, displayName: user.displayName, role: user.role } })
  })

  app.get('/public/stats', async (c) => {
    const db = c.var.db
    const [[d], [co], [f]] = await Promise.all([
      db.select({ n: count() }).from(s.devices),
      db.select({ n: count() }).from(s.companies),
      db.select({ n: count() }).from(s.facilities).where(eq(s.facilities.status, 'active'))
    ])
    return c.json({ devices: d.n, companies: co.n, facilities: f.n })
  })

  app.use('*', async (c, next) => {
    const token = (c.req.header('Authorization') || '').replace(/^Bearer /, '')
    const user = await verifyToken(token, c.var.secret)
    if (!user) throw new HTTPException(401, { message: 'Not signed in' })
    c.set('user', user)
    await next()
  })

  app.get('/state', async (c) => {
    const db = c.var.db
    const keys = Object.keys(TABLES)
    // Newest-inserted first, matching the client's unshift() ordering.
    const results = await Promise.all(keys.map((k) => db.select().from(TABLES[k]).orderBy(sql`rowid desc`)))
    const data = Object.fromEntries(keys.map((k, i) => [k, results[i]]))
    const empty = !data.devices.length && !data.companies.length
    return c.json({ empty, seq: await readSeq(db), data })
  })

  app.post('/sync', async (c) => {
    const db = c.var.db
    const { upserts = {}, deletes = {}, seq } = await c.req.json()
    const stmts = []
    for (const [k, ids] of Object.entries(deletes)) {
      const t = TABLES[k]
      if (t && ids.length) stmts.push(db.delete(t).where(inArray(t.id, ids)))
    }
    for (const [k, rows] of Object.entries(upserts)) {
      const t = TABLES[k]
      if (t && rows.length) stmts.push(...upsertStatements(db, t, rows))
    }
    if (seq) stmts.push(mergeSeqStatement(db, maxSeq(await readSeq(db), seq)))
    if (stmts.length) await db.batch(stmts)
    return c.json({ ok: true })
  })

  app.post('/reset', async (c) => {
    const db = c.var.db
    const { data = {}, seq = {} } = await c.req.json()
    const stmts = Object.values(TABLES).map((t) => db.delete(t))
    for (const [k, t] of Object.entries(TABLES)) {
      const rows = data[k] || []
      if (rows.length) stmts.push(...upsertStatements(db, t, [...rows].reverse()))
    }
    stmts.push(mergeSeqStatement(db, seq))
    await db.batch(stmts)
    return c.json({ ok: true })
  })

  return app
}
