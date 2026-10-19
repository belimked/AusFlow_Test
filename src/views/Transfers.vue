<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-select v-model="f.company" placeholder="Transport company" clearable filterable style="width: 220px"><el-option v-for="c in transports" :key="c.id" :label="c.name" :value="c.id" /></el-select>
        <el-input v-model="f.plate" placeholder="Plate" clearable style="width: 140px" />
        <el-date-picker v-model="f.range" type="daterange" start-placeholder="Start" end-placeholder="End" style="width: 260px" />
      </div>
      <div class="toolbar"><span class="muted">{{ filtered.length }} records</span><span class="spacer" /><el-button @click="download">Export CSV</el-button></div>
      <TransferTable ref="table" :rows="filtered" @view="(r) => (cur = r)" />
    </div>
    <OpDrawer :record="cur" kind="transfer" @close="cur = null" />
  </div>
</template>
<script setup>
import { ref, reactive, computed } from 'vue'
import TransferTable from '../components/TransferTable.vue'
import OpDrawer from '../components/OpDrawer.vue'
import { exportCsv } from '../store/csv'
import { state, transports, plateOf, nameOf, fmtL, fmtTime } from '../store/db'

const cur = ref(null), table = ref(null)
function download() {
  exportCsv('transfers', (table.value?.sorted || filtered.value).map((t) => ({
    ID: t.id, 'Transport company': nameOf('companies', t.companyId), Driver: nameOf('drivers', t.driverId),
    'From vehicle': plateOf(t.fromVehicleId), 'To vehicle': plateOf(t.toVehicleId), Volume: fmtL(t.volume),
    Time: fmtTime(t.at), Location: `${t.lat?.toFixed(5) ?? ''}, ${t.lng?.toFixed(5) ?? ''}`
  })))
}
const f = reactive({ company: '', plate: '', range: null })
const filtered = computed(() => {
  const k = f.plate.trim().toLowerCase()
  const [from, to] = f.range ? [f.range[0].getTime(), f.range[1].getTime() + 864e5] : [0, Infinity]
  return state.transfers.filter((t) => {
    const ts = new Date(t.at).getTime()
    return (!f.company || t.companyId === f.company) && ts >= from && ts < to &&
      (!k || [plateOf(t.fromVehicleId), plateOf(t.toVehicleId)].some((x) => x.toLowerCase().includes(k)))
  })
})
</script>
