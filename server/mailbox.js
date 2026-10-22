import PostalMime from 'postal-mime'
import { eq } from 'drizzle-orm'
import * as s from './schema.js'
import { ingestEmail } from './tickets.js'

const PAGE = 20
const MAX_PAGES = 10
export const NOTIFY_PREFIX = '[AusFlow Ticket'
// Marks our own acknowledgements so a reply that loops back into the mailbox is never ingested.
const ACK_MARKER = 'This is an automated acknowledgement from AusFlow Operations.'
// Mails sent under the old product name (before the rename to AusFlow) are ours too.
const OWN_MARKERS = [ACK_MARKER, 'This is an automated acknowledgement from WasteID Operations.']
const OWN_PREFIXES = [NOTIFY_PREFIX, '[WasteID Ticket']
const NO_REPLY = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce)/i

export function mailConfig(env) {
  return {
    url: (env.MAIL_API_URL || '').replace(/\/+$/, ''),
    jwt: env.MAIL_ADDRESS_JWT || '',
    pollMinutes: +(env.MAIL_POLL_MINUTES ?? 5),
    cronSecret: env.CRON_SECRET || '',
    tz: env.TICKET_TZ || 'Australia/Brisbane',
    autoReply: env.MAIL_AUTO_REPLY !== '0'
  }
}
export const mailEnabled = (mail) => !!(mail.url && mail.jwt)

async function mailApi(mail, path, body) {
  const res = await fetch(mail.url + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${mail.jwt}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body)
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Mail API ${path}: ${res.status} ${text.slice(0, 200)}`)
  try { return JSON.parse(text) } catch { return text }
}

// Plain-text email from the ops mailbox; a no-op when mail is not configured.
export async function sendMail(mail, { to, toName, subject, content }) {
  if (!mailEnabled(mail) || !to) return false
  await mailApi(mail, '/api/send_mail', { from_name: 'AusFlow', to_name: toName || to, to_mail: to, is_html: false, subject: subject.slice(0, 250), content })
  return true
}

const htmlToText =(html) => html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim()

function base64(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

async function readMeta(db, key) {
  const [row] = await db.select().from(s.meta).where(eq(s.meta.key, key))
  return row?.value
}
const writeMeta = (db, key, value) => db.insert(s.meta).values({ key, value }).onConflictDoUpdate({ target: s.meta.key, set: { value } })

const header = (parsed, key) => parsed.headers?.find((h) => h.key === key)?.value || ''

function isAutomated(parsed) {
  const auto = header(parsed, 'auto-submitted').toLowerCase()
  return (auto && auto !== 'no') || /bulk|junk|list|auto_reply/i.test(header(parsed, 'precedence')) || !!header(parsed, 'list-id') ||
    NO_REPLY.test(parsed.from?.address || '')
}

export async function toEmail(m) {
  const parsed = await PostalMime.parse(m.raw || '')
  const fromEmail = parsed.from?.address || m.source || ''
  return {
    parsed,
    email: {
      subject: parsed.subject || '', fromEmail,
      from: parsed.from?.name ? `${parsed.from.name} <${fromEmail}>` : fromEmail,
      body: parsed.text?.trim() || htmlToText(parsed.html || ''), html: parsed.html || null,
      headers: (parsed.headers || []).map(({ key, value }) => ({ key, value })), raw: m.raw || null,
      attachments: (parsed.attachments || []).map((a) => ({
        filename: a.filename, mimeType: a.mimeType, disposition: a.disposition, contentId: a.contentId?.replace(/^<|>$/g, '') || null,
        size: a.content?.byteLength ?? null, dataUrl: a.content ? `data:${a.mimeType || 'application/octet-stream'};base64,${base64(a.content)}` : null
      })),
      messageId: parsed.messageId || m.message_id || `mailbox:${m.id}`,
      receivedAt: parsed.date ? new Date(parsed.date).toISOString() : new Date(m.created_at.replace(' ', 'T') + 'Z').toISOString()
    }
  }
}

// Mails are listed newest first; walk back until the last processed id, then ingest oldest first.
export async function pollMailbox(db, jev, mail) {
  if (!mailEnabled(mail)) throw new Error('Mailbox is not configured (MAIL_API_URL / MAIL_ADDRESS_JWT)')
  const state = (await readMeta(db, 'mailbox')) || {}
  const lastId = state.lastId || 0
  const fresh = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { results = [] } = await mailApi(mail, `/api/mails?limit=${PAGE}&offset=${page * PAGE}`)
    const newer = results.filter((m) => m.id > lastId)
    fresh.push(...newer)
    if (newer.length < results.length || results.length < PAGE) break
  }
  fresh.sort((a, b) => a.id - b.id)
  const own = fresh.length ? (await mailApi(mail, '/api/settings')).address?.toLowerCase() : null
  const created = [], skipped = []
  let processed = lastId
  for (const m of fresh) {
    try {
      const { parsed, email } = await toEmail(m)
      // Acks from any AusFlow mailbox (e.g. UAT replying to production) must not become tickets, or the two instances reply to each other.
      const ours = OWN_MARKERS.some((m) => email.body.includes(m)) || (email.fromEmail.toLowerCase() === own && OWN_PREFIXES.some((p) => email.subject.startsWith(p)))
      if (m.source === 'admin@internal' || ours) {
        skipped.push({ mailId: m.id, reason: 'system' })
      } else {
        const result = await ingestEmail(db, { jev, tz: mail.tz }, email)
        if (result.duplicate) skipped.push({ mailId: m.id, reason: result.duplicate, ticketId: result.ticket.id })
        else {
          created.push(result.ticket)
          if (mail.autoReply && !isAutomated(parsed)) await acknowledge(db, mail, result.ticket).catch((e) => console.error('ack failed', result.ticket.id, e.message))
          await notifyAssignee(db, mail, result.ticket).catch((e) => console.error('notify failed', result.ticket.id, e.message))
        }
      }
    } catch (e) {
      // Stop here so the failed mail is retried on the next poll instead of being lost.
      console.error('mail ingest failed', m.id, e.message)
      break
    }
    processed = m.id
  }
  const next = { lastId: processed, lastPollAt: new Date().toISOString(), lastCreated: created.length }
  await writeMeta(db, 'mailbox', next)
  return { checked: fresh.length, created: created.map((t) => ({ id: t.id, priority: t.priority, subject: t.subject })), skipped, ...next }
}

export async function mailboxStatus(db, mail) {
  const state = (await readMeta(db, 'mailbox')) || {}
  let address = null, sendBalance = null, error = null
  if (mailEnabled(mail)) {
    try { ({ address, send_balance: sendBalance } = await mailApi(mail, '/api/settings')) } catch (e) { error = e.message }
  }
  return { configured: mailEnabled(mail), address, sendBalance, pollMinutes: mail.pollMinutes, autoReply: mail.autoReply, error, ...state }
}

const PRIORITY_LABEL = { critical: 'Critical', normal: 'Normal', low: 'Low' }
const addNote = (db, ticketId, text) => db.insert(s.ticketNotes).values({ id: crypto.randomUUID(), ticketId, kind: 'system', user: 'Mailbox', text, at: new Date().toISOString() })

export async function acknowledge(db, mail, ticket) {
  if (!mailEnabled(mail) || !ticket.fromEmail) return
  const subject = /^re:/i.test(ticket.subject) ? ticket.subject : `Re: ${ticket.subject}`
  await mailApi(mail, '/api/send_mail', {
    from_name: 'AusFlow Operations', to_name: ticket.fromAddr.replace(/\s*<[^>]*>$/, '') || ticket.fromEmail, to_mail: ticket.fromEmail, is_html: false,
    subject: subject.slice(0, 250),
    content: `Hello,\n\nYour email has been received and a ticket has been opened.\n\nTicket number: ${ticket.id}\nStatus: Open\nPriority: ${PRIORITY_LABEL[ticket.priority]}\n\n` +
      `Our operations team will follow up. Please quote ${ticket.id} in any further correspondence.\n\nAusFlow Operations\n\n${ACK_MARKER}`
  })
  await addNote(db, ticket.id, `Acknowledgement sent to ${ticket.fromEmail}`)
}

export async function notifyAssignee(db, mail, ticket) {
  if (!mailEnabled(mail) || !ticket.assigneeId) return
  const [u] = await db.select().from(s.users).where(eq(s.users.id, ticket.assigneeId))
  if (!u?.email) return
  await mailApi(mail, '/api/send_mail', {
    from_name: 'AusFlow Ops', to_name: u.displayName, to_mail: u.email, is_html: false,
    subject: `${NOTIFY_PREFIX} ${ticket.id}] ${ticket.priority.toUpperCase()}: ${ticket.subject}`.slice(0, 250),
    content: `A new ${ticket.priority} ticket has been assigned to you.\n\nTicket: ${ticket.id}\nFrom: ${ticket.fromAddr || '-'}\nSubject: ${ticket.subject}\n\n${(ticket.body || '').slice(0, 3000)}\n\n${ACK_MARKER}`
  })
  await addNote(db, ticket.id, `Notification emailed to ${u.email}`)
}
