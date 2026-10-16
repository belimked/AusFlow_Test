<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="f.q" placeholder="Search plate / QR code" clearable :prefix-icon="'Search'" style="width: 230px" />
        <el-select v-model="f.company" placeholder="Transport company" clearable filterable style="width: 240px"><el-option v-for="c in transports" :key="c.id" :label="c.name" :value="c.id" /></el-select>
        <el-select v-model="f.type" placeholder="Truck type" clearable style="width: 135px"><el-option v-for="(l, v) in VEHICLE_TYPE" :key="v" :label="l" :value="v" /></el-select>
        <el-select v-model="f.status" placeholder="Status" clearable style="width: 110px"><el-option v-for="(l, v) in ENTITY_STATUS" :key="v" :label="l" :value="v" /></el-select>
        <span class="spacer" />
        <el-button @click="download">Export CSV</el-button>
        <el-button v-can="'write'" type="primary" :icon="'Plus'" @click="edit(null)">Add vehicle</el-button>
      </div>
      <el-table @sort-change="onSort" :data="rows" stripe>
        <el-table-column label="Plate" prop="plate" sortable="custom" width="110"><template #default="{ row }"><span class="link mono" @click="router.push('/vehicles/' + row.id)">{{ row.plate }}</span></template></el-table-column>
        <el-table-column label="Transport company" prop="companyId" sortable="custom" min-width="220"><template #default="{ row }">{{ nameOf('companies', row.companyId) }}</template></el-table-column>
        <el-table-column label="Truck type" prop="type" sortable="custom" width="110"><template #default="{ row }">{{ VEHICLE_TYPE[row.type] }}</template></el-table-column>
        <el-table-column label="Tank capacity" prop="tank" sortable="custom" width="135" align="right"><template #default="{ row }">{{ fmtL(row.tank) }}</template></el-table-column>
        <el-table-column label="Current load" prop="load" sortable="custom" width="230"><template #default="{ row }">
          <el-progress :percentage="pct(row)" :status="pct(row) >= 90 ? 'exception' : undefined" :format="() => fmtL(vehicleLoads.get(row.id) || 0)" />
        </template></el-table-column>
        <el-table-column label="Vehicle QR code" prop="qr" sortable="custom" width="160"><template #default="{ row }"><span class="mono">{{ row.qr }}</span></template></el-table-column>
        <el-table-column label="Status" prop="status" sortable="custom" width="95"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[row.status] }}</el-tag></template></el-table-column>
        <el-table-column v-if="can('write')" label="Actions" width="180" fixed="right"><template #default="{ row }">
          <el-button link type="primary" @click="edit(row)">Edit</el-button>
          <el-button link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggle(row)">{{ row.status === 'active' ? 'Deactivate' : 'Activate' }}</el-button>
        </template></el-table-column>
      </el-table>
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
    <EntityDialog v-model="dlg" :title="current ? 'Edit vehicle' : 'Add vehicle'" :fields="vehicleFields(current)" :record="current"
      :defaults="{ ...DEFAULTS.vehicles, companyId: f.company || undefined }" @submit="(d) => upsert('vehicles', current, d)" />
  </div>
</template>
<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Pager from '../components/Pager.vue'
import EntityDialog from '../components/EntityDialog.vue'
import { exportCsv } from '../store/csv'
import { usePaged } from '../composables/paged'
import { state, transports, save, nameOf, vehicleLoads, fmtL, ENTITY_STATUS, VEHICLE_TYPE } from '../store/db'
import { can } from '../store/api'
import { vehicleFields, DEFAULTS, upsert } from '../store/forms'

const route = useRoute(), router = useRouter()
const f = reactive({ q: '', company: route.query.company || '', type: '', status: '' })
function download() {
  exportCsv('vehicles', sorted.value.map((v) => ({ Plate: v.plate, 'Transport company': nameOf('companies', v.companyId),
    'Truck type': VEHICLE_TYPE[v.type], 'Tank capacity': fmtL(v.tank), 'Current load': fmtL(vehicleLoads.value.get(v.id) || 0),
    'Vehicle QR code': v.qr, Status: ENTITY_STATUS[v.status] })))
}
const pct = (v) => Math.min(100, Math.round(((vehicleLoads.value.get(v.id) || 0) / v.tank) * 100))
const filtered = computed(() => {
  const k = f.q.trim().toLowerCase()
  return state.vehicles.filter((v) => (!f.company || v.companyId === f.company) && (!f.type || v.type === f.type) &&
    (!f.status || v.status === f.status) && (!k || [v.plate, v.qr].some((x) => (x || '').toLowerCase().includes(k))))
})
const { page, pageSize, rows, sorted, onSort, total } = usePaged(filtered, 20, { load: (v) => vehicleLoads.value.get(v.id) || 0, companyId: (v) => nameOf('companies', v.companyId) })
const dlg = ref(false), current = ref(null)
function edit(row) { current.value = row; dlg.value = true }
function toggle(row) { row.status = row.status === 'active' ? 'inactive' : 'active'; save() }
</script>
