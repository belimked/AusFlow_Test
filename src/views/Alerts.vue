<template>
  <div class="page">
    <el-row :gutter="12" style="margin-bottom: 12px">
      <el-col v-for="(label, c) in ALERT_CATEGORIES" :key="c" :span="8">
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
        <el-select v-model="f.severity" placeholder="Severity" clearable style="width: 130px"><el-option v-for="(l, v) in SEVERITY" :key="v" :label="l" :value="v" /></el-select>
        <el-select v-model="f.status" placeholder="Follow-up" clearable style="width: 140px"><el-option v-for="(l, v) in ALERT_STATUS" :key="v" :label="l" :value="v" /></el-select>
        <el-radio-group v-model="f.read">
          <el-radio-button value="">All</el-radio-button>
          <el-radio-button value="unread">Unread</el-radio-button>
          <el-radio-button value="read">Read</el-radio-button>
        </el-radio-group>
        <span class="spacer" />
        <el-button :disabled="!filtered.some((a) => !isRead(a))" @click="markRead(filtered)">Mark {{ filtered.length }} shown as read</el-button>
      </div>
      <p class="muted" style="margin: 0 0 8px; font-size: 12px">
        Alerts are generated automatically: devices past their next service date (critical after 4 weeks), jobs open longer than {{ REMIND_HOURS }} h,
        pump-outs in the last 14 days with location / capacity issues, vehicles ≥ 90% full, haulers with 3 or more overdue devices and drivers awaiting approval.
      </p>
      <AlertList :items="rows" />
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
  </div>
</template>
<script setup>
import { reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import AlertList from '../components/AlertList.vue'
import Pager from '../components/Pager.vue'
import { usePaged } from '../composables/paged'
import { alerts, isRead, markRead, statusOf, showAlert, ALERT_TYPES, ALERT_CATEGORIES, ALERT_STATUS, SEVERITY, REMIND_HOURS } from '../store/alerts'

const route = useRoute()
const f = reactive({ q: '', category: route.query.category || '', type: route.query.type || '', severity: route.query.severity || '', status: '', read: '' })
const counts = computed(() => alerts.value.reduce((m, a) => ((m[a.type] = (m[a.type] || 0) + 1), m), {}))
const catCounts = computed(() => alerts.value.reduce((m, a) => ((m[a.category] = (m[a.category] || 0) + 1), m), {}))
const filtered = computed(() => {
  const k = f.q.trim().toLowerCase()
  return alerts.value.filter((a) => (!f.category || a.category === f.category) && (!f.type || a.type === f.type) &&
    (!f.severity || a.severity === f.severity) && (!f.status || statusOf(a.alertId) === f.status) &&
    (!f.read || (f.read === 'read') === isRead(a)) && (!k || (a.alertId + ' ' + a.title + ' ' + a.detail).toLowerCase().includes(k)))
})
const { page, pageSize, rows, total } = usePaged(filtered)
onMounted(() => {
  const id = route.query.alert
  if (!id) return
  const a = alerts.value.find((x) => x.alertId === id)
  if (a) showAlert(a)
  else ElMessage.warning(`Alert ${id} is no longer active (the condition has cleared)`)
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
