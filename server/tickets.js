import { eq, and, inArray, count } from 'drizzle-orm'
import * as s from './schema.js'

export const PRIORITIES = ['critical', 'normal', 'low']
export const TICKET_STATUS = ['open', 'in_progress', 'resolved', 'closed']
const MAX_STATE_CHARS = 8000
// D1 rows are capped at 2 MB; larger raw sources / attachments keep metadata only.
const MAX_STORED_CHARS = 1_500_000

// Keyword hits are handed to JEV as evidence; JEV makes the final call.
export const KEYWORDS = {
  critical: ['urgent', 'emergency', 'danger', 'dangerous', 'hazard', 'hazardous', 'serious', 'severe', 'critical', 'overflow', 'overflowing',
    'spill', 'spillage', 'leak', 'leaking', 'flood', 'flooding', 'sewage', 'fire', 'injury', 'injured', 'toxic', 'explosion', 'blocked', 'blockage',
    'immediately', 'asap', '严重', '危险', '紧急', '溢出', '泄漏', '泄露', '漏水', '着火', '火灾', '受伤', '有毒', '爆炸', '堵塞', '立即', '马上'],
  normal: ['complaint', 'missed', 'overdue', 'broken', 'damaged', 'damage', 'smell', 'odour', 'odor', 'not working', 'faulty', 'reschedule', 'invoice',
    '投诉', '损坏', '逾期', '故障', '异味', '漏收', '发票']
}

export function scanKeywords(subject, body) {
  const text = `${subject || ''}\n${body || ''}`.toLowerCase()
  const hit = (w) => (/^[a-z ]+$/.test(w) ? new RegExp(`\\b${w}\\b`).test(text) : text.includes(w))
  return { critical: KEYWORDS.critical.filter(hit), normal: KEYWORDS.normal.filter(hit) }
}

const CRITERIA = {
  critical: 'Needs action within hours: words such as serious/danger/urgent/严重/危险/紧急, overflow, spill, leak, blockage, sewage on site, safety or environmental hazard, injury, regulator or legal deadline, system outage, angry escalation',
  normal: 'A real problem or request to handle within a few days: complaint, missed or overdue pump-out, damaged device, odour, booking or reschedule, data correction, access issue, invoice dispute',
  low: 'Informational or routine with no action needed soon: thank-you, newsletter, general question, auto-reply, marketing, FYI'
}

export function jevConfig(env) {
  return {
    url: (env.JEV_API_URL || 'https://api.typesafe.ai').replace(/\/+$/, ''),
    model: env.JEV_MODEL || 'jev-latest',
    keys: (env.JEV_API_KEYS || '').split(/[\s,]+/).filter(Boolean)
  }
}

const keywordFallback = (kw) => (kw.critical.length ? 'critical' : kw.normal.length ? 'normal' : 'low')

// Tries each key once, starting at a random one, so a revoked or rate-limited key does not block ingestion.
export async function classifyPriority(jev, { subject, body }, kw) {
  if (!jev.keys.length) return { priority: keywordFallback(kw), confidence: null, classifiedBy: 'keywords (no JEV key)' }
  const evidence = [
    kw.critical.length ? `Critical keywords found: ${kw.critical.join(', ')}` : 'No critical keywords found',
    kw.normal.length ? `Problem keywords found: ${kw.normal.join(', ')}` : 'No problem keywords found'
  ].join('\n')
  const state = `Subject: ${subject || ''}\n\n${(body || '').slice(0, MAX_STATE_CHARS)}\n\n---\nKeyword scan of subject and body:\n${evidence}`
  const request = JSON.stringify({
    model: jev.model, state,
    questions: { priority: { type: 'choice', instructions: 'Classify the priority of this email sent to the waste-management operations mailbox. Use the keyword scan as evidence, but decide from the actual meaning (e.g. "no danger" or a newsletter mentioning "urgent" is not critical).', criteria: CRITERIA } }
  })
  const start = Math.floor(Math.random() * jev.keys.length)
  let lastError = ''
  for (let i = 0; i < jev.keys.length; i++) {
    const key = jev.keys[(start + i) % jev.keys.length]
    try {
      const res = await fetch(`${jev.url}/v1/systemone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: request
      })
      if (!res.ok) { lastError = `HTTP ${res.status}`; continue }
      const data = await res.json()
      const answer = data.answers?.priority
      if (PRIORITIES.includes(answer?.choice)) return { priority: answer.choice, confidence: answer.confidence ?? null, classifiedBy: data.model || jev.model }
      lastError = 'unexpected answer'
    } catch (e) {
      lastError = e.message
    }
  }
  return { priority: keywordFallback(kw), confidence: null, classifiedBy: `keywords (JEV failed: ${lastError})` }
}

export async function pickAssignee(db) {
  const ops = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.role, 'ops'), eq(s.users.status, 'active'))).orderBy(s.users.id)
  if (!ops.length) return null
  const open = await db.select({ id: s.tickets.assigneeId, n: count() }).from(s.tickets)
    .where(inArray(s.tickets.status, ['open', 'in_progress'])).groupBy(s.tickets.assigneeId)
  const load = new Map(open.map((r) => [r.id, r.n]))
  return ops.reduce((best, u) => ((load.get(u.id) || 0) < (load.get(best.id) || 0) ? u : best)).id
}

async function nextTicketId(db) {
  const [row] = await db.select().from(s.meta).where(eq(s.meta.key, 'ticketSeq'))
  const n = (row?.value || 0) + 1
  await db.insert(s.meta).values({ key: 'ticketSeq', value: n }).onConflictDoUpdate({ target: s.meta.key, set: { value: n } })
  return 'TK' + String(n).padStart(6, '0')
}

const dayIn = (tz, iso) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const normSubject = (subject) => subject.replace(/\s+/g, ' ').trim().toLowerCase()
export const dedupeKeyOf = (tz, fromEmail, subject, at) => fromEmail ? `${dayIn(tz, at)}|${fromEmail.toLowerCase()}|${normSubject(subject)}` : null

// Entry point for both the web "simulate email" form and the mailbox poller.
export async function ingestEmail(db, cfg, email, user = 'Mailbox') {
  const subject = String(email.subject || '').trim().slice(0, 300) || '(no subject)'
  const body = String(email.body || '').slice(0, 200000)
  const messageId = email.messageId ? String(email.messageId).slice(0, 300) : null
  const now = new Date().toISOString()
  const receivedAt = email.receivedAt || now
  const fromEmail = String(email.fromEmail || '').trim().toLowerCase() || null
  if (messageId) {
    const [dup] = await db.select().from(s.tickets).where(eq(s.tickets.messageId, messageId))
    if (dup) return { ticket: dup, duplicate: 'message' }
  }
  const dedupeKey = dedupeKeyOf(cfg.tz, fromEmail, subject, receivedAt)
  if (dedupeKey) {
    const [dup] = await db.select().from(s.tickets).where(eq(s.tickets.dedupeKey, dedupeKey)).limit(1)
    if (dup) {
      await db.insert(s.ticketNotes).values({ id: crypto.randomUUID(), ticketId: dup.id, kind: 'system', user,
        text: `Duplicate email from ${fromEmail} with the same subject received ${receivedAt}; skipped`, at: now })
      return { ticket: dup, duplicate: 'sender-subject' }
    }
  }
  const kw = scanKeywords(subject, body)
  const cls = await classifyPriority(cfg.jev, { subject, body }, kw)
  const raw = email.raw && email.raw.length <= MAX_STORED_CHARS ? email.raw : null
  const ticket = {
    id: await nextTicketId(db), subject, body, bodyHtml: email.html || null, headers: email.headers || null, raw,
    fromAddr: String(email.from || '').slice(0, 300), fromEmail, messageId, dedupeKey, keywords: kw,
    priority: cls.priority, confidence: cls.confidence, classifiedBy: cls.classifiedBy,
    assigneeId: await pickAssignee(db), status: 'open', source: email.source || 'email',
    receivedAt, createdAt: now, updatedAt: now
  }
  const attachments = (email.attachments || []).map((a) => ({
    id: crypto.randomUUID(), ticketId: ticket.id, filename: a.filename || null, mimeType: a.mimeType || null,
    contentId: a.contentId || null, disposition: a.disposition || null, size: a.size ?? null,
    dataUrl: a.dataUrl && a.dataUrl.length <= MAX_STORED_CHARS ? a.dataUrl : null
  }))
  const hits = [...kw.critical, ...kw.normal]
  await db.batch([
    db.insert(s.tickets).values(ticket),
    ...attachments.map((a) => db.insert(s.ticketAttachments).values(a)),
    db.insert(s.ticketNotes).values({ id: crypto.randomUUID(), ticketId: ticket.id, kind: 'system', user,
      text: `Created from email; priority ${cls.priority}${cls.confidence != null ? ` (${Math.round(cls.confidence * 100)}%)` : ''} by ${cls.classifiedBy}` +
        `; keywords: ${hits.length ? hits.join(', ') : 'none'}` +
        (attachments.length ? `; ${attachments.length} attachment(s)` : '') +
        (email.raw && !raw ? '; original source too large to store' : ''), at: now })
  ])
  return { ticket, attachments: attachments.length, duplicate: false }
}
