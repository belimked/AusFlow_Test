<template>
  <div class="page">
    <div class="card">
      <div class="chips">
        <div v-for="(l, v) in PRIORITY" :key="v" class="chip" :class="[v, { on: f.priority === v }]" @click="f.priority = f.priority === v ? '' : v">
          <span class="n">{{ counts[v] || 0 }}</span><span>{{ l }}</span>
        </div>
      </div>
      <div v-if="mailbox" class="muted mailbox">
        <template v-if="mailbox.configured">
          <el-icon><Message /></el-icon> Mailbox <b>{{ mailbox.address || '—' }}</b>
          · checked every {{ mailbox.pollMinutes }} min · last check {{ mailbox.lastPollAt ? fmtTime(mailbox.lastPollAt) : 'never' }}
          <template v-if="mailbox.sendBalance != null"> · notification emails left {{ mailbox.sendBalance }}</template>
          <span v-if="mailbox.error" class="err"> · {{ mailbox.error }}</span>
        </template>
        <template v-else>Mailbox not configured (MAIL_API_URL / MAIL_ADDRESS_JWT)</template>
      </div>
      <div class="toolbar">
        <el-input v-model="f.q" placeholder="Search ID / subject / sender" clearable :prefix-icon="'Search'" style="width: 260px" />
        <el-select v-model="f.assignee" placeholder="Assignee" clearable filterable style="width: 200px">
          <el-option v-if="me" label="Assigned to me" value="__me" />
          <el-option label="Unassigned" value="__none" />
          <el-option v-for="u in opsUsers" :key="u.id" :label="u.displayName" :value="u.id" />
        </el-select>
        <el-radio-group v-model="f.status">
          <el-radio-button value="active">Unresolved</el-radio-button>
          <el-radio-button v-for="(l, v) in STATUS" :key="v" :value="v">{{ l }}</el-radio-button>
          <el-radio-button value="all">All</el-radio-button>
        </el-radio-group>
        <span class="spacer" />
        <el-button :icon="'Refresh'" @click="load">Refresh</el-button>
        <el-button v-can="'write'" :icon="'Download'" :loading="polling" :disabled="!mailbox?.configured" @click="poll">Check mailbox now</el-button>
        <el-button v-can="'write'" type="primary" :icon="'Message'" @click="openIngest">Simulate incoming email</el-button>
      </div>
      <el-table :data="paged" stripe v-loading="loading" @row-click="open" row-class-name="clickable">
        <el-table-column label="Ticket" prop="id" width="160"><template #default="{ row }"><span class="mono">{{ row.id }}</span></template></el-table-column>
        <el-table-column label="Priority" width="110"><template #default="{ row }"><el-tag size="small" :type="PRIORITY_TAG[row.priority]" effect="dark">{{ PRIORITY[row.priority] }}</el-tag></template></el-table-column>
        <el-table-column label="Subject" min-width="260" show-overflow-tooltip><template #default="{ row }">
          <el-icon v-if="row.attachmentCount" style="vertical-align: -2px; margin-right: 4px" :title="`${row.attachmentCount} attachment(s)`"><Paperclip /></el-icon>{{ row.subject }}
        </template></el-table-column>
        <el-table-column label="From" prop="fromAddr" width="220" show-overflow-tooltip />
        <el-table-column label="Assignee" width="170"><template #default="{ row }">{{ userName(row.assigneeId) }}</template></el-table-column>
        <el-table-column label="Status" width="120"><template #default="{ row }"><el-tag size="small" :type="STATUS_TAG[row.status]" effect="plain">{{ STATUS[row.status] }}</el-tag></template></el-table-column>
        <el-table-column label="Received" width="150"><template #default="{ row }">{{ fmtTime(row.receivedAt) }}</template></el-table-column>
      </el-table>
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="rows.length" />
      <div class="muted" style="margin-top: 12px">
        Tickets are created from emails sent to the operations mailbox. Subject and body are scanned for keywords (e.g. serious / danger / urgent / overflow / 严重 / 危险),
        and the JEV model uses them as evidence to decide critical / normal / low. The ticket is assigned to the operations user with the fewest open tickets and the sender
        receives an acknowledgement with the ticket number. A second email from the same sender with the same subject on the same day is skipped. Tickets are separate from alerts.
      </div>
    </div>

    <el-drawer v-model="drawer" :title="cur ? cur.id : ''" size="720px" destroy-on-close>
      <template v-if="cur">
        <h3 style="margin: 0 0 8px">{{ cur.subject }}</h3>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="From">{{ cur.fromAddr || '—' }}</el-descriptions-item>
          <el-descriptions-item label="To">{{ headerOf('to') || '—' }}</el-descriptions-item>
          <el-descriptions-item v-if="headerOf('cc')" label="Cc">{{ headerOf('cc') }}</el-descriptions-item>
          <el-descriptions-item label="Received">{{ fmtTime(cur.receivedAt) }}</el-descriptions-item>
          <el-descriptions-item label="Keywords">
            <el-tag v-for="k in cur.keywords?.critical || []" :key="'c' + k" size="small" type="danger" class="kw">{{ k }}</el-tag>
            <el-tag v-for="k in cur.keywords?.normal || []" :key="'n' + k" size="small" type="warning" class="kw">{{ k }}</el-tag>
            <span v-if="!cur.keywords?.critical?.length && !cur.keywords?.normal?.length" class="muted">None found</span>
          </el-descriptions-item>
          <el-descriptions-item label="Classification">
            {{ PRIORITY[cur.priority] }}<template v-if="cur.confidence != null"> · {{ Math.round(cur.confidence * 100) }}%</template>
            <span class="muted"> · {{ cur.classifiedBy }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="Priority">
            <el-select v-model="edit.priority" size="small" style="width: 140px" :disabled="!can('write')"><el-option v-for="(l, v) in PRIORITY" :key="v" :label="l" :value="v" /></el-select>
          </el-descriptions-item>
          <el-descriptions-item label="Assignee">
            <el-select v-model="edit.assigneeId" size="small" clearable style="width: 220px" placeholder="Unassigned" :disabled="!can('write')"><el-option v-for="u in opsUsers" :key="u.id" :label="u.displayName" :value="u.id" /></el-select>
          </el-descriptions-item>
          <el-descriptions-item label="Status">
            <el-radio-group v-model="edit.status" size="small" :disabled="!can('write')"><el-radio-button v-for="(l, v) in STATUS" :key="v" :value="v">{{ l }}</el-radio-button></el-radio-group>
          </el-descriptions-item>
        </el-descriptions>
        <el-tabs v-model="mailTab" class="mail-tabs">
          <el-tab-pane v-if="cur.bodyHtml" label="Email (HTML)" name="html">
            <iframe class="mail-html" sandbox="" referrerpolicy="no-referrer" :srcdoc="htmlDoc" />
          </el-tab-pane>
          <el-tab-pane label="Email (text)" name="text"><div class="mail">{{ cur.body || '(empty body)' }}</div></el-tab-pane>
          <el-tab-pane v-if="cur.headers?.length" :label="`Headers (${cur.headers.length})`" name="headers">
            <div class="mail mono small"><div v-for="(h, i) in cur.headers" :key="i"><b>{{ h.key }}:</b> {{ h.value }}</div></div>
          </el-tab-pane>
        </el-tabs>
        <div v-if="cur.hasRaw" style="margin-bottom: 12px"><el-button size="small" :icon="'Download'" @click="downloadRaw">Download original (.eml)</el-button></div>
        <template v-if="cur.attachments?.length">
          <h4>Attachments ({{ cur.attachments.length }})</h4>
          <div class="atts">
            <div v-for="a in cur.attachments" :key="a.id" class="att">
              <el-image v-if="isImage(a) && a.dataUrl" :src="a.dataUrl" :preview-src-list="imageUrls" :initial-index="imageUrls.indexOf(a.dataUrl)" fit="cover" class="thumb" preview-teleported />
              <el-icon v-else :size="40" class="thumb file"><Document /></el-icon>
              <div class="att-name" :title="a.filename">{{ a.filename || '(unnamed)' }}</div>
              <div class="muted small">{{ fmtSize(a.size) }}<template v-if="a.disposition === 'inline'"> · inline</template></div>
              <a v-if="a.dataUrl" :href="a.dataUrl" :download="a.filename || 'attachment'" class="small">Download</a>
              <span v-else class="muted small">Too large to store</span>
            </div>
          </div>
        </template>
        <template v-if="can('write')">
          <el-input v-model="edit.note" type="textarea" :rows="2" placeholder="Add a note (optional)" />
          <div style="text-align: right; margin: 8px 0 16px"><el-button type="primary" :loading="saving" @click="saveTicket">Save</el-button></div>
        </template>
        <h4>History</h4>
        <el-timeline>
          <el-timeline-item v-for="n in notes" :key="n.id" :timestamp="`${fmtTime(n.at)} · ${n.user || ''}`" :type="n.kind === 'note' ? 'primary' : ''">{{ n.text }}</el-timeline-item>
        </el-timeline>
      </template>
    </el-drawer>

    <el-dialog v-model="ingestDlg" title="Simulate incoming email" width="560px">
      <el-form label-width="80px" @submit.prevent>
        <el-form-item label="From"><el-input v-model="mail.from" placeholder="sender@example.com" /></el-form-item>
        <el-form-item label="Subject"><el-input v-model="mail.subject" /></el-form-item>
        <el-form-item label="Body"><el-input v-model="mail.body" type="textarea" :rows="8" /></el-form-item>
      </el-form>
      <div class="muted">The email is classified by JEV and assigned automatically, exactly as the mailbox poller will do.</div>
      <template #footer><el-button @click="ingestDlg = false">Cancel</el-button><el-button type="primary" :loading="saving" @click="ingest">Create ticket</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import Pager from '../components/Pager.vue'
import { api, can, currentUser } from '../store/api'
import { fmtTime } from '../store/db'

const PRIORITY = { critical: 'Critical', normal: 'Normal', low: 'Low' }
const PRIORITY_TAG = { critical: 'danger', normal: 'warning', low: 'info' }
const STATUS = { open: 'New', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const STATUS_TAG = { open: 'danger', in_progress: 'warning', resolved: 'success', closed: 'info' }
const me = currentUser()?.id

const tickets = ref([])
const users = ref([])
const loading = ref(false)
const f = reactive({ q: '', priority: '', assignee: '', status: 'active' })
const opsUsers = computed(() => users.value.filter((u) => u.role !== 'user' && u.status === 'active'))
const userName = (id) => users.value.find((u) => u.id === id)?.displayName || (id ? id : 'Unassigned')

const statusOk = (t) => f.status === 'all' || (f.status === 'active' ? ['open', 'in_progress'].includes(t.status) : t.status === f.status)
const assigneeOk = (t) => !f.assignee || (f.assignee === '__me' ? t.assigneeId === me : f.assignee === '__none' ? !t.assigneeId : t.assigneeId === f.assignee)
const textOk = (t) => !f.q || `${t.id} ${t.subject} ${t.fromAddr}`.toLowerCase().includes(f.q.toLowerCase())
const base = computed(() => tickets.value.filter((t) => statusOk(t) && assigneeOk(t) && textOk(t)))
const counts = computed(() => base.value.reduce((m, t) => ({ ...m, [t.priority]: (m[t.priority] || 0) + 1 }), {}))
const rows = computed(() => base.value.filter((t) => !f.priority || t.priority === f.priority))

const page = ref(1)
const pageSize = ref(20)
watch(f, () => (page.value = 1))
const paged = computed(() => rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

const mailbox = ref(null)
const polling = ref(false)
async function poll() {
  polling.value = true
  try {
    const r = await api('/mailbox/poll', {})
    ElMessage.success(r.created.length ? `${r.created.length} new ticket(s) created from ${r.checked} new email(s)` : `No new tickets (${r.checked} new email(s))`)
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    polling.value = false
  }
}

async function load() {
  loading.value = true
  try {
    ;[tickets.value, users.value, mailbox.value] = await Promise.all([api('/tickets'), api('/users'), api('/mailbox/status')])
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const drawer = ref(false)
const cur = ref(null)
const notes = ref([])
const edit = reactive({ priority: '', assigneeId: '', status: '', note: '' })
const saving = ref(false)
const mailTab = ref('text')
const headerOf = (k) => cur.value?.headers?.filter((h) => h.key === k).map((h) => h.value).join(', ') || ''
const isImage = (a) => /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(a.mimeType || '')
const imageUrls = computed(() => (cur.value?.attachments || []).filter((a) => isImage(a) && a.dataUrl).map((a) => a.dataUrl))
const fmtSize = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`)
// Inline images are referenced as cid:; the iframe is sandboxed (no scripts) and remote images are blocked by CSP.
const htmlDoc = computed(() => {
  if (!cur.value?.bodyHtml) return ''
  const byCid = new Map((cur.value.attachments || []).filter((a) => a.contentId && a.dataUrl).map((a) => [a.contentId, a.dataUrl]))
  const html = cur.value.bodyHtml.replace(/cid:([^"'\s)>]+)/gi, (m, id) => byCid.get(id) || m)
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">${html}`
})
async function downloadRaw() {
  const { raw } = await api(`/tickets/${cur.value.id}/raw`)
  const url = URL.createObjectURL(new Blob([raw], { type: 'message/rfc822' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${cur.value.id}.eml`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function open(t) {
  Object.assign(edit, { priority: t.priority, assigneeId: t.assigneeId || '', status: t.status, note: '' })
  ;[cur.value, notes.value] = await Promise.all([api(`/tickets/${t.id}`), api(`/tickets/${t.id}/notes`)])
  mailTab.value = cur.value.bodyHtml ? 'html' : 'text'
  drawer.value = true
}
async function saveTicket() {
  saving.value = true
  try {
    const updated = await api('/tickets/' + cur.value.id, { ...edit, assigneeId: edit.assigneeId || null }, 'PATCH')
    Object.assign(cur.value, { status: updated.status, priority: updated.priority, assigneeId: updated.assigneeId })
    edit.note = ''
    notes.value = await api(`/tickets/${cur.value.id}/notes`)
    ElMessage.success('Ticket updated')
    load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

const ingestDlg = ref(false)
const mail = reactive({ from: '', subject: '', body: '' })
function openIngest() {
  Object.assign(mail, { from: '', subject: '', body: '' })
  ingestDlg.value = true
}
async function ingest() {
  saving.value = true
  try {
    const { ticket, duplicate } = await api('/tickets/ingest', { ...mail })
    ingestDlg.value = false
    await load()
    if (duplicate) ElMessage.warning(`Duplicate email (${duplicate === 'message' ? 'same message' : 'same sender and subject today'}) — skipped, existing ticket ${ticket.id}`)
    else ElMessage.success(`Ticket ${ticket.id} created · ${PRIORITY[ticket.priority]} · ${userName(ticket.assigneeId)}`)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.kw { margin: 0 4px 4px 0; }
.mail-tabs { margin-top: 12px; }
.mail-html { width: 100%; height: 420px; border: 1px solid #ebeef5; border-radius: 6px; background: #fff; }
.small { font-size: 12px; }
.atts { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
.att { border: 1px solid #ebeef5; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.thumb { width: 100%; height: 100px; border-radius: 4px; background: #f7f8fa; }
.thumb.file { display: flex; align-items: center; justify-content: center; color: #909399; }
.att-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mailbox { display: flex; align-items: center; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; }
.mailbox .err { color: #f56c6c; }
.chips { display: flex; gap: 12px; margin-bottom: 12px; }
.chip { display: flex; align-items: baseline; gap: 8px; padding: 8px 16px; border: 1px solid #e4e7ed; border-left-width: 4px; border-radius: 6px; cursor: pointer; user-select: none; }
.chip .n { font-size: 20px; font-weight: 700; }
.chip.critical { border-left-color: #f56c6c; } .chip.normal { border-left-color: #e6a23c; } .chip.low { border-left-color: #909399; }
.chip.on.critical { background: #fef0f0; border-color: #f56c6c; } .chip.on.normal { background: #fdf6ec; border-color: #e6a23c; } .chip.on.low { background: #f4f4f5; border-color: #909399; }
.mail { white-space: pre-wrap; background: #f7f8fa; border: 1px solid #ebeef5; border-radius: 6px; padding: 12px; margin: 12px 0; max-height: 320px; overflow: auto; font-size: 13px; }
:deep(.clickable) { cursor: pointer; }
</style>
