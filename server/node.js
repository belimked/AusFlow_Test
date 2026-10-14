import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { createApp } from './app.js'

const secret = process.env.AUTH_SECRET || readFileSync('.dev.vars', 'utf8').match(/^AUTH_SECRET=(.*)$/m)?.[1]
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
  await next()
})
const port = +(process.env.PORT || 8788)
serve({ fetch: app.fetch, port }, () => console.log(`API on http://127.0.0.1:${port}/api`))
