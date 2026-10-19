import { handle } from 'hono/cloudflare-pages'
import { drizzle } from 'drizzle-orm/d1'
import { createApp } from '../../server/app.js'
import { jevConfig } from '../../server/tickets.js'
import { mailConfig } from '../../server/mailbox.js'

const app = createApp(async (c, next) => {
  if (!c.env.AUTH_SECRET) return c.json({ error: 'AUTH_SECRET is not configured' }, 500)
  c.set('db', drizzle(c.env.DB))
  c.set('secret', c.env.AUTH_SECRET)
  c.set('jev', jevConfig(c.env))
  c.set('mail', mailConfig(c.env))
  await next()
})

export const onRequest = handle(app)
