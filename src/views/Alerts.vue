<template>
  <div class="page">
    <el-row :gutter="12" style="margin-bottom: 12px">
      <el-col v-for="(label, c) in ALERT_CATEGORIES" :key="c" :span="6">
        <div class="card type cat" :class="{ on: f.category === c }" @click="f.category = f.category === c ? '' : c; f.type = ''">
          <div class="muted">{{ label }} alerts</div>
          <div class="n">{{ catCounts[c] || 0 }}</div>
        </div>
      </el-col>
    </el-row>
    <el-row :gutter="12" style="margin-bottom: 12px">
      <el-col v-for="(label, t) in ALERT_TYPES" :key="t" :span="3" style="flex: 1; max-width: none">
        <div class="card type" :class="{ on: f.type === t }" @click="f.type = f.type === t ? '' : t">
          <div class="muted">{{ label }}</div>
          <div class="n">{{ counts[t] || 0 }}</div>
        </div>
      </el-col>
    </el-row>
    <div class="card">
      <div class="toolbar">
        <el-input v-model="f.q" placeholder="Search Alert ID, device, vehicle, driver, location" clearable :prefix-icon="'Search'" style="width: 320px" />
        <el-select v-model="f.category" placeholder="Category" clearable style="width: 160px"><el-option v-for="(l, v) in ALERT_CATEGORIES" :key="v" :label="l" :value="v" /></el-select>
        <el-select v-model="f.type" placeholder="Type" clearable style="width: 190px"><el-option v-for="(l, v) in ALERT_TYPES" :key="v" :label="l" :value="v" /></el-select>
        <SeverityChips v-model="f.severity" :items="exceptSeverity" />
        <el-select v-model="f.status" placeholder="Status" style="width: 170px"><el-option label="Active" value="active" /><el-option v-for="(l, v) in ALERT_STATUS" :key="v" :label="l" :value="v" /><el-option label="All" value="all" /></el-select>
        <el-radio-group v-model="f.read">
          <el-radio-button value="">All</el-radio-button>
          <el-radio-button value="unread">Unread</el-radio-button>
          <el-radio-button value="read">Read</el-radio-button>
        </el-radio-group>
        <span class="spacer" />
        <el-button @click="download">Export CSV</el-button>
        <el-button :disabled="!filtered.some((a) => !isRead(a))" @click="markRead(filtered)">Mark {{ filtered.length }} shown as read</el-button>
      </div>
      <p class="muted" style="margin: 0 0 8px; font-size: 12px">
        Alerts are generated automatically: devices past their next service date (critical after 4 weeks), jobs open longer than {{ REMIND_HOURS }} h,
        pump-outs in the last 14 days with location / capacity issues, vehicles ≥ 90% full, transport companies with 3 or more overdue devices, drivers awaiting approval, transfers larger than the receiving truck's remaining capacity, and recent suspicious activity (load, unload, daily volume, waste-type and impossibly fast driver-leg checks).
      </p>
      <AlertList :items="rows" />
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
  </div>
</template>
<script setup>
import { reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AlertList from '../components/AlertList.vue'
import SeverityChips from '../components/SeverityChips.vue'
import Pager from '../components/Pager.vue'
import { exportCsv } from '../store/csv'
import { fmtTime } from '../store/db'
import { usePaged } from '../composables/paged'
import { alerts, isRead, markRead, statusOf, showAlert, ALERT_TYPES, ALERT_CATEGORIES, ALERT_STATUS, SEVERITY, REMIND_HOURS, isActive } from '../store/alerts'

const route = useRoute(), router = useRouter()
const f = reactive({ q: '', category: '', type: '', severity: '', status: 'active', read: '' })
watch(() => route.query, (query) => {
  for (const key of Object.keys(f)) f[key] = query[key] || (key === 'status' ? 'active' : '')
}, { immediate: true })
const counts = computed(() => alerts.value.reduce((m, a) => ((m[a.type] = (m[a.type] || 0) + 1), m), {}))
const catCounts = computed(() => alerts.value.reduce((m, a) => ((m[a.category] = (m[a.category] || 0) + 1), m), {}))
const exceptSeverity = computed(() => {
  const k = f.q.trim().toLowerCase()
  return alerts.value.filter((a) => (!f.category || a.category === f.category) && (!f.type || a.type === f.type) &&
    (f.status === 'all' || (f.status === 'active' ? isActive(a) : statusOf(a.alertId) === f.status)) &&
    (!f.read || (f.read === 'read') === isRead(a)) && (!k || (a.alertId + ' ' + a.title + ' ' + a.detail).toLowerCase().includes(k)))
})
const filtered = computed(() => exceptSeverity.value.filter((a) => !f.severity || a.severity === f.severity))
const { page, pageSize, rows, sorted, total } = usePaged(filtered)
function download() {
  exportCsv('alerts', sorted.value.map((a) => ({ 'Alert ID': a.alertId, Category: ALERT_CATEGORIES[a.category],
    Type: ALERT_TYPES[a.type], Severity: SEVERITY[a.severity], 'Follow-up status': ALERT_STATUS[statusOf(a.alertId)],
    Read: isRead(a) ? 'Read' : 'Unread', Title: a.title, Detail: a.detail, Time: fmtTime(a.at) })))
}
watch(() => route.query.alert, (id) => {
  if (!id) return
  const a = alerts.value.find((x) => x.alertId === id)
  if (a) showAlert(a)
  else ElMessage.warning(`Alert ${id} is no longer active (the condition has cleared)`)
}, { immediate: true })
watch(f, () => {
  const query = Object.fromEntries(Object.entries(f).filter(([, v]) => v).map(([k, v]) => [k, v]))
  if (route.query.alert) query.alert = route.query.alert
  if (JSON.stringify(query) !== JSON.stringify(route.query)) router.replace({ query })
})
</script>
<style scoped>
.type { cursor: pointer; padding: 12px 14px; border: 1px solid transparent; }
.type.on { border-color: #409eff; }
.type .muted { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.type .n { font-size: 22px; font-weight: 700; margin-top: 4px; }
.type.cat { padding: 10px 14px; }
.type.cat .n { font-size: 20px; }
</style>
