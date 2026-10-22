import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq, and, desc, inArray, sql, count, getTableColumns } from 'drizzle-orm'
import * as s from './schema.js'
import { verifyPassword, hashPassword, signToken, verifyToken } from './auth.js'
import { ingestEmail, PRIORITIES, TICKET_STATUS } from './tickets.js'
import { pollMailbox, mailboxStatus, notifyAssignee, sendMail } from './mailbox.js'

export const ROLES = ['admin', 'ops', 'user']
const requireRole = (...roles) => async (c, next) => {
  if (!roles.includes(c.var.user.role)) throw new HTTPException(403, { message: 'You do not have permission for this action' })
  await next()
}
const canWrite = requireRole('admin', 'ops')
const publicUser = ({ passwordHash, failedLogins, ...u }) => u
const LOCK_AFTER = 3
const LOCK_MINUTES = 15
const RESET_TTL = 3600
const resetFingerprint = (u) => u.passwordHash.slice(-16)

export const TABLES = {
  companies: s.companies, locations: s.locations, devices: s.devices, drivers: s.drivers, vehicles: s.vehicles,
  facilities: s.facilities, pickups: s.pickups, transfers: s.transfers, unloads: s.unloads,
  changeLogs: s.changeLogs, importLogs: s.importLogs, alertReads: s.alertReads, alertNotes: s.alertNotes, notes: s.notes, inspections: s.inspections, reportedIssues: s.reportedIssues
}
// D1 allows at most 100 bound parameters per statement.
const MAX_PARAMS = 100
const PHOTO_KINDS = {
  device: ['device', 'coords'], company: ['photo'], vehicle: ['photo'], driver: ['photo'], alert: ['photo'], inspection: ['photo'], issue: ['photo'],
  // Taken in the driver app.
  pickup: ['before', 'after', 'photo'], unload: ['photo'], transfer: ['photo']
}
// D1 rows are capped at 2 MB; clients downscale to ~1600px JPEG before upload.
const MAX_PHOTO_CHARS = 1_500_000
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/

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
    const db = c.var.db
    const [user] = await db.select().from(s.users).where(eq(s.users.username, String(username || '')))
    const now = Date.now()
    if (user?.lockedUntil && Date.parse(user.lockedUntil) > now) {
      const mins = Math.ceil((Date.parse(user.lockedUntil) - now) / 60000)
      throw new HTTPException(423, { message: `Too many failed sign-in attempts. Try again in ${mins} min, or reset your password.` })
    }
    if (!user || user.status !== 'active' || !(await verifyPassword(String(password || ''), user.passwordHash))) {
      if (user) {
        // Old WasteID: three wrong passwords lock the account. A timed lock (not a permanent one) stops guessing
        // without letting anyone lock a colleague out for good by typing their username.
        const failed = (user.failedLogins || 0) + 1
        const lock = failed >= LOCK_AFTER
        await db.update(s.users).set({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(now + LOCK_MINUTES * 60000).toISOString() : null })
          .where(eq(s.users.id, user.id))
        if (lock) throw new HTTPException(423, { message: `Too many failed sign-in attempts. Your account is locked for ${LOCK_MINUTES} min. Reset your password to sign in now.` })
      }
      throw new HTTPException(401, { message: 'Invalid username or password' })
    }
    if (user.failedLogins || user.lockedUntil) await db.update(s.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(s.users.id, user.id))
    const token = await signToken({ sub: user.id, name: user.displayName, role: user.role }, c.var.secret)
    return c.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } })
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

  // Called by the cron trigger with x-cron-secret, or by signed-in admin/ops users.
  app.post('/mailbox/poll', async (c) => {
    const secret = c.var.mail.cronSecret
    const viaCron = secret && c.req.header('x-cron-secret') === secret
    if (!viaCron) {
      const user = await verifyToken((c.req.header('Authorization') || '').replace(/^Bearer /, ''), c.var.secret)
      if (!user) throw new HTTPException(401, { message: 'Not signed in' })
      if (!['admin', 'ops', 'authority'].includes(user.role)) throw new HTTPException(403, { message: 'You do not have permission for this action' })
    }
    try {
      return c.json(await pollMailbox(c.var.db, c.var.jev, c.var.mail))
    } catch (e) {
      throw new HTTPException(502, { message: e.message })
    }
  })

  // Read-only device lookup for TWAIN, authorised by a shared key instead of a user session.
  app.get('/integration/devices/:ref', async (c) => {
    const key = c.var.integrationKey
    const given = c.req.header('x-integration-key') || ''
    let diff = !key || given.length !== key.length ? 1 : 0
    for (let i = 0; !diff && i < key.length; i++) diff |= key.charCodeAt(i) ^ given.charCodeAt(i)
    if (diff) throw new HTTPException(401, { message: 'Invalid integration key' })
    const db = c.var.db
    const [device] = await db.select().from(s.devices).where(eq(s.devices.ref, c.req.param('ref')))
    if (!device) throw new HTTPException(404, { message: 'Device not found' })
    const [[location], [transporter], pickups] = await Promise.all([
      device.locationId ? db.select().from(s.locations).where(eq(s.locations.id, device.locationId)) : [],
      device.companyId ? db.select({ id: s.companies.id, name: s.companies.name, phone: s.companies.phone }).from(s.companies).where(eq(s.companies.id, device.companyId)) : [],
      db.select({ id: s.pickups.id, startAt: s.pickups.startAt, volume: s.pickups.volume, status: s.pickups.status }).from(s.pickups).where(eq(s.pickups.deviceId, device.id)).orderBy(desc(s.pickups.startAt)).limit(5)
    ])
    const nextDue = device.lastService && device.freqWeeks ? new Date(Date.parse(device.lastService) + device.freqWeeks * 7 * 864e5).toISOString() : null
    return c.json({
      device: { id: device.id, ref: device.ref, status: device.status, type: device.type, capacity: device.capacity, freqWeeks: device.freqWeeks, lastService: device.lastService },
      location: location ? { id: location.id, name: location.name, agreementNo: location.agreementNo } : null,
      transporter: transporter || null, pickups, nextDue
    })
  })

  // ---------- password reset (no session) ----------
  // Same answer whether or not the account exists, so the endpoint cannot be used to discover usernames.
  app.post('/password/forgot', async (c) => {
    const { login } = await c.req.json()
    const key = String(login || '').trim().toLowerCase()
    if (!key) throw new HTTPException(400, { message: 'Enter your username or email address' })
    const rows = await c.var.db.select().from(s.users)
    const user = rows.find((u) => u.status === 'active' && (u.username.toLowerCase() === key || (u.email || '').toLowerCase() === key))
    if (user?.email) {
      const token = await signToken({ sub: user.id, purpose: 'reset', fp: resetFingerprint(user) }, c.var.secret, RESET_TTL)
      const link = `${new URL(c.req.url).origin}/#/reset-password?token=${encodeURIComponent(token)}`
      await sendMail(c.var.mail || {}, {
        to: user.email, toName: user.displayName, subject: 'Reset your WasteID password',
        content: `Hello ${user.displayName},\n\nOpen this link within an hour to choose a new password:\n\n${link}\n\nIf you did not ask for this, ignore this email; your password stays the same.\n\nWasteID`,
      }).catch((e) => console.error('reset email failed:', e.message))
    }
    return c.json({ ok: true })
  })

  app.post('/password/reset', async (c) => {
    const { token, password } = await c.req.json()
    const invalid = new HTTPException(400, { message: 'This reset link is invalid or has expired. Ask for a new one.' })
    const p = await verifyToken(String(token || ''), c.var.secret)
    if (!p || p.purpose !== 'reset') throw invalid
    const [user] = await c.var.db.select().from(s.users).where(eq(s.users.id, String(p.sub)))
    // The fingerprint changes with the password, so a link works only once.
    if (!user || user.status !== 'active' || resetFingerprint(user) !== p.fp) throw invalid
    if (String(password || '').length < 6) throw new HTTPException(400, { message: 'Password must be at least 6 characters' })
    await c.var.db.update(s.users).set({ passwordHash: await hashPassword(String(password)), failedLogins: 0, lockedUntil: null }).where(eq(s.users.id, user.id))
    return c.json({ ok: true })
  })

  app.use('*', async (c, next) => {
    const token = (c.req.header('Authorization') || '').replace(/^Bearer /, '')
    const user = await verifyToken(token, c.var.secret)
    // Reset tokens are signed the same way but must never work as a session.
    if (!user || user.purpose) throw new HTTPException(401, { message: 'Not signed in' })
    if (user.role === 'authority') user.role = 'admin'
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

  // What a client needs before writing: the id counters and the pickups still in progress. A fraction of /state,
  // so the driver app can check for conflicts without downloading everything.
  app.get('/state/summary', async (c) => {
    const db = c.var.db
    const ongoing = await db.select().from(s.pickups).where(eq(s.pickups.status, 'ongoing')).orderBy(sql`rowid desc`)
    return c.json({ seq: await readSeq(db), ongoing })
  })

  app.post('/sync', canWrite, async (c) => {
    const db = c.var.db
    const { upserts = {}, deletes = {}, seq } = await c.req.json()
    const stmts = []
    for (const [k, ids] of Object.entries(deletes)) {
      const t = TABLES[k]
      if (t && ids.length) stmts.push(db.delete(t).where(inArray(t.id, ids)))
    }
    for (const [k, rows] of Object.entries(upserts)) {
      const t = TABLES[k]
      if (t && rows.length) stmts.push(...upsertStatements(db, t, [...rows].reverse()))
    }
    if (seq) stmts.push(mergeSeqStatement(db, maxSeq(await readSeq(db), seq)))
    if (stmts.length) await db.batch(stmts)
    return c.json({ ok: true })
  })

  app.get('/photos', async (c) => {
    const { type, id } = c.req.query()
    const rows = await c.var.db.select().from(s.photos)
      .where(and(eq(s.photos.entityType, String(type)), eq(s.photos.entityId, String(id)))).orderBy(desc(s.photos.at))
    return c.json(rows)
  })

  app.get('/photos/counts', async (c) => {
    const rows = await c.var.db.select({ id: s.photos.entityId, n: count() }).from(s.photos)
      .where(eq(s.photos.entityType, String(c.req.query('type')))).groupBy(s.photos.entityId)
    return c.json(Object.fromEntries(rows.map((r) => [r.id, r.n])))
  })

  app.post('/photos', canWrite, async (c) => {
    const { type, id, kind, name, dataUrl } = await c.req.json()
    if (!PHOTO_KINDS[type]?.includes(kind) || typeof id !== 'string' || !id) throw new HTTPException(400, { message: 'Invalid photo target' })
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_PHOTO_CHARS || !DATA_URL.test(dataUrl)) {
      throw new HTTPException(400, { message: 'Photo must be a JPEG/PNG/WebP image under 1.1 MB' })
    }
    const row = {
      id: crypto.randomUUID(), entityType: type, entityId: id, kind, name: String(name || '').slice(0, 200),
      dataUrl, user: c.var.user.name, at: new Date().toISOString()
    }
    await c.var.db.insert(s.photos).values(row)
    return c.json(row)
  })

  app.delete('/photos/:id', canWrite, async (c) => {
    await c.var.db.delete(s.photos).where(eq(s.photos.id, c.req.param('id')))
    return c.json({ ok: true })
  })

  // ---------- users ----------
  app.get('/users', async (c) => {
    const rows = await c.var.db.select().from(s.users).orderBy(s.users.id)
    return c.json(rows.map(publicUser))
  })

  const userFields = async (body, creating) => {
    const out = {}
    if (creating || body.username !== undefined) {
      out.username = String(body.username || '').trim()
      if (!/^[A-Za-z0-9._-]{3,40}$/.test(out.username)) throw new HTTPException(400, { message: 'Username must be 3-40 letters, digits, dot, dash or underscore' })
    }
    if (creating || body.displayName !== undefined) {
      out.displayName = String(body.displayName || '').trim().slice(0, 80)
      if (!out.displayName) throw new HTTPException(400, { message: 'Display name is required' })
    }
    if (creating || body.role !== undefined) {
      if (!ROLES.includes(body.role)) throw new HTTPException(400, { message: 'Invalid role' })
      out.role = body.role
    }
    if (body.email !== undefined) {
      out.email = String(body.email || '').trim().slice(0, 200) || null
      if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new HTTPException(400, { message: 'Invalid email address' })
    }
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) throw new HTTPException(400, { message: 'Invalid status' })
      out.status = body.status
    }
    if (creating || body.password) {
      if (String(body.password || '').length < 6) throw new HTTPException(400, { message: 'Password must be at least 6 characters' })
      out.passwordHash = await hashPassword(String(body.password))
      // A new password also lifts a sign-in lock.
      out.failedLogins = 0
      out.lockedUntil = null
    }
    return out
  }

  // Old WasteID "My Details": users change their own name, email and password; the current password is required.
  app.patch('/me', async (c) => {
    const body = await c.req.json()
    const [user] = await c.var.db.select().from(s.users).where(eq(s.users.id, c.var.user.sub))
    if (!user) throw new HTTPException(404, { message: 'User not found' })
    if (!(await verifyPassword(String(body.currentPassword || ''), user.passwordHash))) {
      throw new HTTPException(403, { message: 'Your current password is not correct' })
    }
    const fields = await userFields({ displayName: body.displayName, email: body.email, password: body.newPassword }, false)
    if (Object.keys(fields).length) await c.var.db.update(s.users).set(fields).where(eq(s.users.id, user.id))
    const [row] = await c.var.db.select().from(s.users).where(eq(s.users.id, user.id))
    return c.json(publicUser(row))
  })

  app.post('/users', requireRole('admin'), async (c) => {
    const fields = await userFields(await c.req.json(), true)
    const [dup] = await c.var.db.select().from(s.users).where(eq(s.users.username, fields.username))
    if (dup) throw new HTTPException(409, { message: 'Username already exists' })
    const row = { id: 'US' + crypto.randomUUID().slice(0, 8).toUpperCase(), status: 'active', ...fields }
    await c.var.db.insert(s.users).values(row)
    return c.json(publicUser(row))
  })

  app.patch('/users/:id', requireRole('admin'), async (c) => {
    const id = c.req.param('id')
    const fields = await userFields(await c.req.json(), false)
    if (id === c.var.user.sub && ((fields.role && fields.role !== 'admin') || fields.status === 'inactive')) {
      throw new HTTPException(400, { message: 'You cannot remove your own admin access' })
    }
    if (fields.username) {
      const [dup] = await c.var.db.select().from(s.users).where(eq(s.users.username, fields.username))
      if (dup && dup.id !== id) throw new HTTPException(409, { message: 'Username already exists' })
    }
    if (Object.keys(fields).length) await c.var.db.update(s.users).set(fields).where(eq(s.users.id, id))
    const [row] = await c.var.db.select().from(s.users).where(eq(s.users.id, id))
    if (!row) throw new HTTPException(404, { message: 'User not found' })
    return c.json(publicUser(row))
  })

  // ---------- tickets ----------
  const { body: _b, bodyHtml: _h, headers: _hd, raw: _r, ...LIST_COLUMNS } = getTableColumns(s.tickets)
  app.get('/tickets', async (c) => {
    const rows = await c.var.db.select(LIST_COLUMNS).from(s.tickets).orderBy(desc(s.tickets.createdAt))
    const counts = await c.var.db.select({ id: s.ticketAttachments.ticketId, n: count() }).from(s.ticketAttachments).groupBy(s.ticketAttachments.ticketId)
    const n = new Map(counts.map((r) => [r.id, r.n]))
    return c.json(rows.map((r) => ({ ...r, attachmentCount: n.get(r.id) || 0 })))
  })

  app.get('/tickets/:id', async (c) => {
    const { raw, ...t } = getTableColumns(s.tickets)
    const [row] = await c.var.db.select({ ...t, hasRaw: sql`${s.tickets.raw} is not null` }).from(s.tickets).where(eq(s.tickets.id, c.req.param('id')))
    if (!row) throw new HTTPException(404, { message: 'Ticket not found' })
    const attachments = await c.var.db.select().from(s.ticketAttachments).where(eq(s.ticketAttachments.ticketId, row.id))
    return c.json({ ...row, hasRaw: !!row.hasRaw, attachments })
  })

  app.get('/tickets/:id/raw', async (c) => {
    const [row] = await c.var.db.select({ raw: s.tickets.raw }).from(s.tickets).where(eq(s.tickets.id, c.req.param('id')))
    if (!row?.raw) throw new HTTPException(404, { message: 'Original source not stored' })
    return c.json({ raw: row.raw })
  })

  app.get('/tickets/:id/notes', async (c) => {
    const rows = await c.var.db.select().from(s.ticketNotes).where(eq(s.ticketNotes.ticketId, c.req.param('id'))).orderBy(desc(s.ticketNotes.at))
    return c.json(rows)
  })

  app.post('/tickets/ingest', canWrite, async (c) => {
    const body = await c.req.json()
    if (!String(body.subject || '').trim() && !String(body.body || '').trim()) throw new HTTPException(400, { message: 'Subject or body is required' })
    const fromEmail = String(body.from || '').match(/[^\s<>]+@[^\s<>]+/)?.[0] || ''
    const result = await ingestEmail(c.var.db, { jev: c.var.jev, tz: c.var.mail.tz }, { ...body, fromEmail, source: 'manual' }, c.var.user.name)
    if (!result.duplicate) await notifyAssignee(c.var.db, c.var.mail, result.ticket).catch((e) => console.error('notify failed', e.message))
    return c.json(result)
  })

  app.get('/mailbox/status', async (c) => c.json(await mailboxStatus(c.var.db, c.var.mail)))

  app.patch('/tickets/:id', canWrite, async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const [t] = await c.var.db.select().from(s.tickets).where(eq(s.tickets.id, id))
    if (!t) throw new HTTPException(404, { message: 'Ticket not found' })
    const set = {}, notes = []
    const now = new Date().toISOString()
    const note = (text) => notes.push({ id: crypto.randomUUID(), ticketId: id, kind: 'change', text, user: c.var.user.name, at: now })
    if (body.status !== undefined && body.status !== t.status) {
      if (!TICKET_STATUS.includes(body.status)) throw new HTTPException(400, { message: 'Invalid status' })
      set.status = body.status; note(`Status: ${t.status} → ${body.status}`)
    }
    if (body.priority !== undefined && body.priority !== t.priority) {
      if (!PRIORITIES.includes(body.priority)) throw new HTTPException(400, { message: 'Invalid priority' })
      set.priority = body.priority; note(`Priority: ${t.priority} → ${body.priority}`)
    }
    if (body.assigneeId !== undefined && body.assigneeId !== t.assigneeId) {
      const [u] = body.assigneeId ? await c.var.db.select().from(s.users).where(eq(s.users.id, String(body.assigneeId))) : [null]
      if (body.assigneeId && !u) throw new HTTPException(400, { message: 'Unknown assignee' })
      set.assigneeId = body.assigneeId || null; note(`Assignee: ${u ? u.displayName : 'unassigned'}`)
    }
    if (String(body.note || '').trim()) notes.push({ id: crypto.randomUUID(), ticketId: id, kind: 'note', text: String(body.note).trim().slice(0, 5000), user: c.var.user.name, at: now })
    if (!Object.keys(set).length && !notes.length) return c.json(t)
    await c.var.db.batch([
      c.var.db.update(s.tickets).set({ ...set, updatedAt: now }).where(eq(s.tickets.id, id)),
      ...(notes.length ? [c.var.db.insert(s.ticketNotes).values(notes)] : [])
    ])
    return c.json({ ...t, ...set, updatedAt: now })
  })

  app.post('/reset', async (c) => {
    const db = c.var.db
    const [hasData] = await db.select({ id: s.companies.id }).from(s.companies).limit(1)
    if (hasData && c.var.user.role !== 'admin') throw new HTTPException(403, { message: 'Only admins can reset demo data' })
    const { data = {}, seq = {} } = await c.req.json()
    const stmts = [...Object.values(TABLES), s.photos].map((t) => db.delete(t))
    for (const [k, t] of Object.entries(TABLES)) {
      const rows = data[k] || []
      if (rows.length) stmts.push(...upsertStatements(db, t, [...rows].reverse()))
    }
    stmts.push(mergeSeqStatement(db, seq))
    // D1 limits batch size; deletes must finish before inserts (and seq update last).
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50))
    return c.json({ ok: true })
  })

  return app
}
