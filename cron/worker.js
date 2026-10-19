// Cloudflare Pages has no cron triggers; this Worker only pings the Pages API on a schedule.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(poll(env))
  }
}

async function poll(env) {
  const res = await fetch(env.APP_URL.replace(/\/+$/, '') + '/api/mailbox/poll', { method: 'POST', headers: { 'x-cron-secret': env.CRON_SECRET } })
  const text = await res.text()
  if (!res.ok) throw new Error(`poll failed: ${res.status} ${text.slice(0, 200)}`)
  console.log(text.slice(0, 500))
}
