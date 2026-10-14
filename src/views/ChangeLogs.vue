<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="f.q" placeholder="Device Ref / value" clearable :prefix-icon="'Search'" style="width: 220px" />
        <el-select v-model="f.field" placeholder="Field" clearable filterable style="width: 150px"><el-option v-for="x in fields" :key="x" :value="x" /></el-select>
        <el-select v-model="f.source" placeholder="Source" clearable style="width: 100px"><el-option v-for="s in ['Web', 'App', 'CSV']" :key="s" :value="s" /></el-select>
        <el-select v-model="f.user" placeholder="Changed by" clearable style="width: 150px"><el-option v-for="u in users" :key="u" :value="u" /></el-select>
        <el-date-picker v-model="f.range" type="daterange" start-placeholder="Start date" end-placeholder="End date" style="width: 290px" />
      </div>
      <ChangeLogTable :rows="filtered" />
    </div>
  </div>
</template>
<script setup>
import { reactive, computed } from 'vue'
import ChangeLogTable from '../components/ChangeLogTable.vue'
import { state } from '../store/db'

const f = reactive({ q: '', field: '', source: '', user: '', range: null })
const fields = computed(() => [...new Set(state.changeLogs.map((l) => l.field))])
const users = computed(() => [...new Set(state.changeLogs.map((l) => l.user))])
const filtered = computed(() => {
  const k = f.q.trim().toLowerCase()
  const [from, to] = f.range ? [f.range[0].getTime(), f.range[1].getTime() + 864e5] : [0, Infinity]
  return state.changeLogs.filter((l) => {
    const t = new Date(l.at).getTime()
    return (!k || [l.deviceId, l.oldValue, l.newValue].some((x) => (x || '').toLowerCase().includes(k))) &&
      (!f.field || l.field === f.field) && (!f.source || l.source === f.source) && (!f.user || l.user === f.user) && t >= from && t < to
  })
})
</script>
