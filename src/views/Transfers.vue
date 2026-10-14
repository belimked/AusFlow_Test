<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-select v-model="f.company" placeholder="Hauler" clearable filterable style="width: 220px"><el-option v-for="c in state.companies" :key="c.id" :label="c.name" :value="c.id" /></el-select>
        <el-input v-model="f.plate" placeholder="Plate" clearable style="width: 140px" />
        <el-date-picker v-model="f.range" type="daterange" start-placeholder="Start" end-placeholder="End" style="width: 260px" />
      </div>
      <TransferTable :rows="filtered" @view="(r) => (cur = r)" />
    </div>
    <OpDrawer :record="cur" kind="transfer" @close="cur = null" />
  </div>
</template>
<script setup>
import { ref, reactive, computed } from 'vue'
import TransferTable from '../components/TransferTable.vue'
import OpDrawer from '../components/OpDrawer.vue'
import { state, plateOf } from '../store/db'

const cur = ref(null)
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
