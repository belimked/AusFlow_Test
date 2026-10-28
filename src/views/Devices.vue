<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="f.q" placeholder="Search Ref / name / location / Tag ID" clearable :prefix-icon="'Search'" style="width: 320px" />
        <el-select v-model="f.status" placeholder="Status" clearable style="width: 120px">
          <el-option v-for="(l, v) in DEVICE_STATUS" :key="v" :label="l" :value="v" />
        </el-select>
        <el-select v-model="f.type" placeholder="Device type" multiple collapse-tags clearable filterable style="width: 180px">
          <el-option v-for="t in types" :key="t" :value="t" />
        </el-select>
        <el-select v-model="f.company" placeholder="Last serviced by" clearable filterable style="width: 220px">
          <el-option label="(Never serviced)" value="none" />
          <el-option v-for="c in transports" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-select v-model="f.owner" placeholder="Owner" clearable filterable style="width: 200px">
          <el-option label="(Unassigned)" value="none" />
          <el-option v-for="c in owners" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-select v-model="f.suburb" placeholder="Suburb" clearable filterable style="width: 170px"><el-option v-for="s in suburbs" :key="s" :value="s" /></el-select>
        <el-select v-model="f.qr" placeholder="QR" clearable style="width: 130px"><el-option label="Has QR" value="has" /><el-option label="No QR" value="none" /></el-select>
        <el-select v-model="f.freq" placeholder="Frequency" clearable style="width: 165px"><el-option label="Has frequency" value="has" /><el-option label="No frequency" value="none" /></el-select>
        <el-select v-model="f.custodian" placeholder="Custodian" clearable style="width: 170px"><el-option label="(Unspecified)" value="none" /><el-option v-for="(label, key) in CUSTODIAN" :key="key" :label="label" :value="key" /></el-select>
        <el-select v-model="f.overdue" placeholder="Overdue" clearable style="width: 195px"><el-option label="Overdue" value="1" /><el-option label="Overdue > 3 months" value="3m" /><el-option label="Overdue > 6 months" value="6m" /></el-select>
      </div>
      <div class="toolbar">
        <span class="muted">{{ filtered.length.toLocaleString() }} devices, <span class="red">{{ overdueCount }}</span> overdue</span>
        <span class="spacer" />
        <el-button @click="download">Export CSV</el-button>
        <el-button v-can="'write'" :icon="'Upload'" @click="router.push('/import')">CSV Import</el-button>
        <el-button v-can="'write'" type="primary" :icon="'Plus'" @click="openNew()">Add Device</el-button>
      </div>
      <DeviceTable :rows="filtered" @sorted="(v) => (sorted = v)">
        <el-table-column v-if="can('write')" label="Actions" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">Edit</el-button>
            <el-button v-if="row.status === 'Active'" link type="danger" @click="setStatus(row, 'Inactive')">Deactivate</el-button>
            <el-button v-else link type="success" @click="setStatus(row, 'Active')">Activate</el-button>
          </template>
        </el-table-column>
      </DeviceTable>
    </div>
    <DeviceDialog v-model="dlg" :record="current" :defaults="defaults" @saved="(ref) => !current && router.push('/devices/' + ref)" />
  </div>
</template>
<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import DeviceTable from '../components/DeviceTable.vue'
import DeviceDialog from '../components/DeviceDialog.vue'
import { state, servicedBy, transports, nameOf, tagsOf, isOverdue, overdueDays, nextService, fmtDate, fmtL, overdueText, updateDevice, DEVICE_STATUS, CUSTODIAN } from '../store/db'
import { exportCsv } from '../store/csv'
import { can } from '../store/api'

const route = useRoute(), router = useRouter()
const f = reactive({ q: '', status: '', type: [], company: '', owner: '', suburb: '', qr: '', overdue: '', freq: '', custodian: '' })
const keys = ['q', 'status', 'type', 'company', 'owner', 'suburb', 'qr', 'overdue', 'freq', 'custodian']
let syncing = false
watch(() => route.query, (query) => {
  syncing = true
  for (const key of keys) f[key] = key === 'type' ? (Array.isArray(query.type) ? query.type : query.type ? [query.type] : []) : (query[key] || '')
  syncing = false
}, { immediate: true })
watch(f, () => {
  if (syncing) return
  const query = Object.fromEntries(keys.filter((key) => f[key]?.length).map((key) => [key, f[key]]))
  if (route.query.newAt) query.newAt = route.query.newAt
  if (keys.some((key) => JSON.stringify(query[key] || '') !== JSON.stringify(route.query[key] || ''))) router.replace({ query })
})
const suburbOf = computed(() => new Map(state.locations.map((l) => [l.id, l.suburb || ''])))
const suburbs = computed(() => [...new Set(state.devices.map((d) => suburbOf.value.get(d.locationId)).filter(Boolean))].sort())
const custodianOf = computed(() => new Map(state.locations.map((l) => [l.id, l.custodianCategory])))
const owners = computed(() => {
  const ids = new Set(state.devices.map((d) => d.ownerId).filter(Boolean))
  return state.companies.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))
})
const sorted = ref(null)
function download() {
  exportCsv('devices', (sorted.value || filtered.value).map((d) => ({
    'Device Ref': d.ref, 'Device name': d.aka, 'QR/Tag': tagsOf(d).join(' '),
    Location: nameOf('locations', d.locationId), Custodian: CUSTODIAN[custodianOf.value.get(d.locationId)] || '(Unspecified)', Suburb: suburbOf.value.get(d.locationId) || '',
    'Device type': d.type, Capacity: fmtL(d.capacity), Frequency: d.freqWeeks ? `${d.freqWeeks} wk` : '',
    'Last service': fmtDate(d.lastService), 'Next service': fmtDate(nextService(d)), Overdue: overdueText(d),
    'Last serviced by': servicedBy(d) ? nameOf('companies', servicedBy(d)) : '', Status: DEVICE_STATUS[d.status],
    Owner: d.ownerId ? nameOf('companies', d.ownerId) : '',
    'Waste type': d.waste, 'Approval category': d.approvalCategory, Lat: d.lat ?? '', Lng: d.lng ?? ''
  })))
}
const types = computed(() => [...new Set(state.devices.map((d) => d.type).filter(Boolean))].sort())
const filtered = computed(() => {
  const k = f.q.trim().toLowerCase()
  const tagKey = k.replace(/[\s-]/g, '')
  return state.devices.filter((d) =>
    (!f.status || d.status === f.status) && (!f.type.length || f.type.includes(d.type)) &&
    (!f.suburb || suburbOf.value.get(d.locationId) === f.suburb) &&
    (!f.qr || (f.qr === 'has' ? tagsOf(d).length > 0 : tagsOf(d).length === 0)) &&
    (!f.company || (f.company === 'none' ? !servicedBy(d) : servicedBy(d) === f.company)) &&
    (!f.owner || (f.owner === 'none' ? !d.ownerId : d.ownerId === f.owner)) &&
    (!f.freq || (f.freq === 'has' ? Number(d.freqWeeks) > 0 : !Number(d.freqWeeks))) &&
    (!f.custodian || (f.custodian === 'none' ? !custodianOf.value.get(d.locationId) : custodianOf.value.get(d.locationId) === f.custodian)) &&
    (!f.overdue || overdueDays(d) > ({ '1': 0, '3m': 91, '6m': 182 }[f.overdue] ?? 0)) &&
    (!k || [d.ref, d.aka, nameOf('locations', d.locationId)].some((x) => (x || '').toLowerCase().includes(k)) ||
      (tagKey && tagsOf(d).some((t) => t.toLowerCase().includes(tagKey)))))
})
const overdueCount = computed(() => filtered.value.filter(isOverdue).length)

const dlg = ref(false), current = ref(null), defaults = ref(null)
function openNew(locationId) { current.value = null; defaults.value = locationId ? { locationId } : null; dlg.value = true }
function openEdit(row) { current.value = row; defaults.value = null; dlg.value = true }
async function setStatus(row, status) {
  if (status === 'Inactive') { try { await ElMessageBox.confirm(`Deactivate device ${row.ref}? Overdue status will no longer be calculated.`, 'Deactivate Device', { type: 'warning' }) } catch { return } }
  updateDevice(row.id, { status }, 'Web')
  ElMessage.success('Updated and recorded in the Change Log')
}
onMounted(() => route.query.newAt && openNew(route.query.newAt))
</script>
