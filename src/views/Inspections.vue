<template>
  <div class="page"><div class="card">
    <div class="toolbar"><el-input v-model="q" placeholder="Search device / location / inspector / comments" clearable style="width: 330px" />
      <el-select v-model="result" clearable placeholder="Result" style="width: 180px"><el-option v-for="(label, key) in INSPECTION_RESULTS" :key="key" :label="label" :value="key" /></el-select>
      <el-date-picker v-model="dates" type="daterange" start-placeholder="From" end-placeholder="To" />
      <span class="spacer" /><el-button @click="download">Export CSV</el-button></div>
    <el-table :data="rows" stripe @sort-change="onSort">
      <el-table-column label="Date" prop="at" sortable="custom" width="190"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
      <el-table-column label="Device" prop="deviceId" sortable="custom" width="150"><template #default="{ row }"><span class="link" @click="router.push('/devices/' + row.deviceId)">{{ device(row)?.ref || row.deviceId }}</span></template></el-table-column>
      <el-table-column label="Location" prop="location" sortable="custom" min-width="180"><template #default="{ row }">{{ location(row)?.name }}</template></el-table-column>
      <el-table-column label="Suburb" prop="suburb" sortable="custom" width="145"><template #default="{ row }">{{ location(row)?.suburb }}</template></el-table-column>
      <el-table-column label="Result" prop="result" sortable="custom" width="170"><template #default="{ row }"><el-tag :type="row.result === 'compliant' ? 'success' : 'warning'">{{ INSPECTION_RESULTS[row.result] }}</el-tag></template></el-table-column>
      <el-table-column label="Inspector" prop="inspector" sortable="custom" width="150" />
      <el-table-column label="Comments" prop="comments" sortable="custom" min-width="220" show-overflow-tooltip />
    </el-table><Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
  </div></div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Pager from '../components/Pager.vue'
import { usePaged } from '../composables/paged'
import { exportCsv } from '../store/csv'
import { state, idx, fmtTime, INSPECTION_RESULTS } from '../store/db'
const router = useRouter(), q = ref(''), result = ref(''), dates = ref(null)
const device = (i) => idx.devices.value.get(i.deviceId)
const location = (i) => idx.locations.value.get(device(i)?.locationId)
const filtered = computed(() => state.inspections.filter((i) => (!result.value || i.result === result.value) &&
  (!dates.value || (new Date(i.at) >= dates.value[0] && new Date(i.at) <= new Date(dates.value[1]).setHours(23, 59, 59, 999))) &&
  (!q.value || [device(i)?.ref, location(i)?.name, location(i)?.suburb, i.inspector, i.comments].some((v) => (v || '').toLowerCase().includes(q.value.toLowerCase())))))
const { page, pageSize, rows, sorted, onSort, total } = usePaged(filtered, 20, { location: (i) => location(i)?.name, suburb: (i) => location(i)?.suburb })
function download() { exportCsv('inspections', sorted.value.map((i) => ({ Date: fmtTime(i.at), Device: device(i)?.ref, Location: location(i)?.name, Suburb: location(i)?.suburb, Result: INSPECTION_RESULTS[i.result], Inspector: i.inspector, Comments: i.comments }))) }
</script>
