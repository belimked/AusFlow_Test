import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { createApp } from './app.js'
import { jevConfig } from './tickets.js'
import { mailConfig, mailEnabled, pollMailbox } from './mailbox.js'

const devVars = Object.fromEntries([...readFileSync('.dev.vars', 'utf8').matchAll(/^(\w+)=(.*)$/gm)].map((m) => [m[1], m[2].trim()]))
const env = { ...devVars, ...process.env }
const secret = env.AUTH_SECRET
const jev = jevConfig(env)
const mail = mailConfig(env)
mkdirSync('.wrangler', { recursive: true })
const client = createClient({ url: process.env.DATABASE_URL || 'file:.wrangler/dev.db' })
const db = drizzle(client)

await client.execute('CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY)')
const done = new Set((await client.execute('SELECT name FROM _migrations')).rows.map((r) => r.name))
for (const f of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(f)) continue
  const stmts = readFileSync(`migrations/${f}`, 'utf8').split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)
  await client.batch([...stmts, { sql: 'INSERT INTO _migrations VALUES (?)', args: [f] }], 'write')
  console.log('applied', f)
}

const app = createApp(async (c, next) => {
  c.set('db', db)
  c.set('secret', secret)
  c.set('jev', jev)
  c.set('mail', mail)
  c.set('integrationKey', env.INTEGRATION_KEY)
  await next()
})
const port = +(process.env.PORT || 8788)
serve({ fetch: app.fetch, port }, () => console.log(`API on http://127.0.0.1:${port}/api`))

if (mailEnabled(mail) && mail.pollMinutes > 0) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const r = await pollMailbox(db, jev, mail)
      if (r.created.length) console.log(`mailbox: ${r.created.length} ticket(s) created`, r.created.map((t) => t.id).join(', '))
    } catch (e) {
      console.error('mailbox poll failed:', e.message)
    } finally {
      running = false
    }
  }
  setInterval(tick, mail.pollMinutes * 6e4)
  tick()
  console.log(`mailbox polling every ${mail.pollMinutes} min`)
}
