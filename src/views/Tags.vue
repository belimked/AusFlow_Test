<template>
  <div class="page"><div class="card">
    <div class="toolbar"><span class="muted">{{ filtered.length }} tags · <span class="link" @click="router.push('/devices?qr=none')">{{ withoutQr }} devices without QR</span></span><span class="spacer" /><el-button @click="download">Export CSV</el-button></div>
    <div class="toolbar">
      <el-input v-model="f.q" placeholder="Search tag / device / location" clearable style="width: 250px" />
      <el-select v-model="f.status" placeholder="Status" clearable style="width: 150px"><el-option label="Allocated" value="Allocated" /><el-option label="Duplicate" value="Duplicate" /></el-select>
      <el-select v-model="f.suburb" placeholder="Suburb" filterable clearable style="width: 160px"><el-option v-for="s in suburbs" :key="s" :value="s" /></el-select>
      <el-select v-model="f.hauler" placeholder="Hauler" filterable clearable style="width: 220px"><el-option v-for="c in haulers" :key="c.id" :label="c.name" :value="c.id" /></el-select>
      <el-date-picker v-model="f.range" type="daterange" start-placeholder="Allocated from" end-placeholder="Allocated to" style="width: 270px" />
    </div>
    <el-table :data="paged" stripe size="small" @sort-change="onSort">
      <el-table-column prop="code" label="Tag code" sortable="custom" min-width="145" />
      <el-table-column prop="status" label="Status" sortable="custom" width="115"><template #default="{ row }"><el-tag :type="row.status === 'Duplicate' ? 'danger' : 'success'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column prop="device" label="Device" sortable="custom" width="130"><template #default="{ row }"><span class="link" @click="router.push('/devices/' + row.deviceId)">{{ row.device }}</span></template></el-table-column>
      <el-table-column prop="deviceStatus" label="Device status" sortable="custom" width="135" />
      <el-table-column prop="location" label="Location" sortable="custom" min-width="200"><template #default="{ row }"><span class="link" @click="router.push('/locations/' + row.locationId)">{{ row.location }}</span></template></el-table-column>
      <el-table-column prop="suburb" label="Suburb" sortable="custom" width="140" />
      <el-table-column prop="hauler" label="Responsible hauler" sortable="custom" min-width="210" />
      <el-table-column prop="allocatedBy" label="Allocated by" sortable="custom" min-width="190" />
      <el-table-column prop="allocatedAt" label="Allocated at" sortable="custom" width="170"><template #default="{ row }">{{ fmtTime(row.allocatedAt) }}</template></el-table-column>
    </el-table>
    <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
  </div></div>
</template>
<script setup>
import { computed, reactive, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Pager from '../components/Pager.vue'
import { usePaged } from '../composables/paged'
import { state, haulers, tagsOf, nameOf, fmtTime } from '../store/db'
import { exportCsv } from '../store/csv'
const route = useRoute(), router = useRouter()
const keys = ['q', 'status', 'suburb', 'hauler', 'from', 'to']
const f = reactive({ q: '', status: '', suburb: '', hauler: '', range: null })
let syncing = false
watch(() => route.query, (q) => {
  syncing = true
  for (const k of keys.slice(0, 4)) f[k] = q[k] || ''
  f.range = q.from && q.to ? [new Date(q.from), new Date(q.to)] : null
  syncing = false
}, { immediate: true })
watch(f, () => {
  if (syncing) return
  const q = Object.fromEntries(keys.slice(0, 4).filter((k) => f[k]).map((k) => [k, f[k]]))
  if (f.range) { q.from = f.range[0].toISOString().slice(0, 10); q.to = f.range[1].toISOString().slice(0, 10) }
  if (keys.some((k) => (q[k] || '') !== (route.query[k] || ''))) router.replace({ query: q })
})
const withoutQr = computed(() => state.devices.filter((d) => !tagsOf(d).length).length)
const logs = computed(() => {
  const byDevice = new Map()
  const devices = new Map(state.devices.map((d) => [d.id, d]))
  for (const log of state.changeLogs) {
    if (!['Tag ID', 'QR code'].includes(log.field)) continue
    if (!byDevice.has(log.deviceId)) byDevice.set(log.deviceId, [])
    byDevice.get(log.deviceId).push(log)
  }
  const result = new Map()
  for (const [id, list] of byDevice) {
    list.sort((a, b) => b.at.localeCompare(a.at))
    const device = devices.get(id)
    for (const code of tagsOf(device || {})) {
      const log = list.find((entry) => entry.newValue?.includes(code))
      if (log) result.set(id + '\0' + code, log)
    }
  }
  return result
})
const rows = computed(() => {
  const locations = new Map(state.locations.map((l) => [l.id, l]))
  const count = new Map()
  for (const d of state.devices) for (const code of new Set(tagsOf(d))) count.set(code, (count.get(code) || 0) + 1)
  return state.devices.flatMap((d) => [...new Set(tagsOf(d))].map((code) => {
    const loc = locations.get(d.locationId)
    const log = logs.value.get(d.id + '\0' + code)
    return { code, status: count.get(code) > 1 ? 'Duplicate' : 'Allocated', device: d.ref, deviceId: d.id,
      deviceStatus: d.status, location: loc?.name || '—', locationId: d.locationId, suburb: loc?.suburb || '',
      haulerId: d.companyId, hauler: d.companyId ? nameOf('companies', d.companyId) : '—',
      allocatedBy: log?.user || 'CSV import', allocatedAt: log?.at || '' }
  }))
})
const suburbs = computed(() => [...new Set(rows.value.map((r) => r.suburb).filter(Boolean))].sort())
const filtered = computed(() => {
  const q = f.q.trim().toLowerCase()
  const from = f.range ? new Date(f.range[0]).getTime() : -Infinity
  const to = f.range ? new Date(f.range[1]).getTime() + 864e5 : Infinity
  return rows.value.filter((r) => (!q || [r.code, r.device, r.location].some((v) => v.toLowerCase().includes(q))) &&
    (!f.status || r.status === f.status) && (!f.suburb || r.suburb === f.suburb) && (!f.hauler || r.haulerId === f.hauler) &&
    (!f.range || (r.allocatedAt && new Date(r.allocatedAt).getTime() >= from && new Date(r.allocatedAt).getTime() < to)))
})
const { page, pageSize, rows: paged, sorted, onSort, total } = usePaged(toRef(filtered), 20)
function download() {
  exportCsv('device-tags', sorted.value.map((r) => ({ 'Tag code': r.code, Status: r.status, Device: r.device,
    'Device status': r.deviceStatus, Location: r.location, Suburb: r.suburb, 'Responsible hauler': r.hauler,
    'Allocated by': r.allocatedBy, 'Allocated at': fmtTime(r.allocatedAt) })))
}
</script>
