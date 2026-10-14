<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="f.q" placeholder="ID / Device Ref / Location" clearable :prefix-icon="'Search'" style="width: 245px" />
        <el-select v-model="f.company" placeholder="Hauler" clearable filterable style="width: 220px"><el-option v-for="c in state.companies" :key="c.id" :label="c.name" :value="c.id" /></el-select>
        <el-select v-model="f.driver" placeholder="Driver" clearable filterable style="width: 150px"><el-option v-for="d in drivers" :key="d.id" :label="d.name" :value="d.id" /></el-select>
        <el-select v-model="f.flag" placeholder="Flags" clearable style="width: 165px">
          <el-option label="Location mismatch" value="location" /><el-option label="Over capacity" value="capacity" /><el-option label="No location" value="nolocation" /><el-option label="Any flag" value="any" />
        </el-select>
        <el-select v-model="f.status" placeholder="Status" clearable style="width: 140px"><el-option label="In progress" value="ongoing" /><el-option label="Completed" value="done" /></el-select>
        <el-date-picker v-model="f.range" type="daterange" start-placeholder="Start" end-placeholder="End" style="width: 260px" />
        <el-button @click="download">Export CSV</el-button>
      </div>
      <div class="muted" style="margin-bottom: 8px">{{ filtered.length }} records, total {{ fmtL(filtered.reduce((s, p) => s + (p.volume || 0), 0)) }}</div>
      <PickupTable :rows="filtered" @sorted="(v) => (sorted = v)" />
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import PickupTable from '../components/PickupTable.vue'
import { state, nameOf, plateOf, fmtL, fmtM, fmtTime } from '../store/db'

import { exportCsv } from '../store/csv'

const route = useRoute()
const sorted = ref(null)
function download() {
  exportCsv('pickups', (sorted.value || filtered.value).map((p) => ({
    ID: p.id, 'Device / Location': `${p.deviceId} ${nameOf('locations', p.locationId)}`,
    Hauler: nameOf('companies', p.companyId), Driver: nameOf('drivers', p.driverId), Vehicle: plateOf(p.vehicleId),
    'Waste type': p.waste || '', Volume: fmtL(p.volume), Time: fmtTime(p.endAt || p.startAt), 'Distance from device': fmtM(p.distance),
    'Flags / Status': p.status === 'ongoing' ? 'In progress' : p.flags.join(', ')
  })))
}
const f = reactive({ q: '', company: '', driver: '', flag: route.query.flag || '', status: '', range: null })
const drivers = computed(() => state.drivers.filter((d) => !f.company || d.companyId === f.company))
const filtered = computed(() => {
  const k = f.q.trim().toLowerCase()
  const [from, to] = f.range ? [f.range[0].getTime(), f.range[1].getTime() + 864e5] : [0, Infinity]
  return state.pickups.filter((p) => {
    const t = new Date(p.endAt || p.startAt).getTime()
    return (!f.company || p.companyId === f.company) && (!f.driver || p.driverId === f.driver) && (!f.status || p.status === f.status) &&
      (!f.flag || (f.flag === 'any' ? p.flags.length : p.flags.includes(f.flag))) && t >= from && t < to &&
      (!k || [p.id, p.deviceId, nameOf('locations', p.locationId)].some((x) => (x || '').toLowerCase().includes(k)))
  })
})
</script>
