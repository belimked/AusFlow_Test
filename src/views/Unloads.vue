<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-select v-model="f.company" placeholder="Hauler" clearable filterable style="width: 220px"><el-option v-for="c in state.companies" :key="c.id" :label="c.name" :value="c.id" /></el-select>
        <el-select v-model="f.facility" placeholder="Treatment Facility" clearable style="width: 240px"><el-option v-for="x in state.facilities" :key="x.id" :label="x.name" :value="x.id" /></el-select>
        <el-input v-model="f.plate" placeholder="Plate" clearable style="width: 140px" />
        <el-date-picker v-model="f.range" type="daterange" start-placeholder="Start" end-placeholder="End" style="width: 260px" />
      </div>
      <div class="muted" style="margin-bottom: 8px">{{ filtered.length }} records, total {{ fmtL(filtered.reduce((s, u) => s + u.volume, 0)) }}</div>
      <UnloadTable :rows="filtered" @view="(r) => (cur = r)" />
    </div>
    <OpDrawer :record="cur" kind="unload" @close="cur = null" />
  </div>
</template>
<script setup>
import { ref, reactive, computed } from 'vue'
import UnloadTable from '../components/UnloadTable.vue'
import OpDrawer from '../components/OpDrawer.vue'
import { state, plateOf, fmtL } from '../store/db'

const cur = ref(null)
const f = reactive({ company: '', facility: '', plate: '', range: null })
const filtered = computed(() => {
  const k = f.plate.trim().toLowerCase()
  const [from, to] = f.range ? [f.range[0].getTime(), f.range[1].getTime() + 864e5] : [0, Infinity]
  return state.unloads.filter((u) => {
    const ts = new Date(u.at).getTime()
    return (!f.company || u.companyId === f.company) && (!f.facility || u.facilityId === f.facility) && ts >= from && ts < to &&
      (!k || plateOf(u.vehicleId).toLowerCase().includes(k))
  })
})
</script>
