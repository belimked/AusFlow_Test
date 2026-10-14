<template>
  <div class="page">
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
        <el-input v-model="f.q" placeholder="Search device, vehicle, driver, location" clearable :prefix-icon="'Search'" style="width: 300px" />
        <el-select v-model="f.type" placeholder="Type" clearable style="width: 190px"><el-option v-for="(l, v) in ALERT_TYPES" :key="v" :label="l" :value="v" /></el-select>
        <el-select v-model="f.severity" placeholder="Severity" clearable style="width: 130px"><el-option v-for="(l, v) in SEVERITY" :key="v" :label="l" :value="v" /></el-select>
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
        pump-outs in the last 14 days with location / capacity issues, vehicles ≥ 90% full and drivers awaiting approval.
      </p>
      <AlertList :items="rows" />
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
  </div>
</template>
<script setup>
import { reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import AlertList from '../components/AlertList.vue'
import Pager from '../components/Pager.vue'
import { usePaged } from '../composables/paged'
import { alerts, isRead, markRead, ALERT_TYPES, SEVERITY, REMIND_HOURS } from '../store/alerts'

const route = useRoute()
const f = reactive({ q: '', type: route.query.type || '', severity: route.query.severity || '', read: '' })
const counts = computed(() => alerts.value.reduce((m, a) => ((m[a.type] = (m[a.type] || 0) + 1), m), {}))
const filtered = computed(() => {
  const k = f.q.trim().toLowerCase()
  return alerts.value.filter((a) => (!f.type || a.type === f.type) && (!f.severity || a.severity === f.severity) &&
    (!f.read || (f.read === 'read') === isRead(a)) && (!k || (a.title + ' ' + a.detail).toLowerCase().includes(k)))
})
const { page, pageSize, rows, total } = usePaged(filtered)
</script>
<style scoped>
.type { cursor: pointer; padding: 12px 14px; border: 1px solid transparent; }
.type.on { border-color: #409eff; }
.type .muted { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.type .n { font-size: 22px; font-weight: 700; margin-top: 4px; }
</style>
