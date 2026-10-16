<template>
  <div class="page">
    <h2>{{ isTransportView ? 'Transport companies' : 'Companies' }}</h2>
    <div class="card">
      <div class="toolbar">
        <el-input v-model="q" placeholder="Search company / ABN / contact" clearable :prefix-icon="'Search'" style="width: 290px" />
        <el-select v-model="typeFilter" placeholder="Type" style="width: 165px"><el-option label="All companies" value="all" /><el-option v-for="(label, key) in COMPANY_TYPES" :key="key" :value="key" :label="label" /></el-select>
        <el-select v-model="status" placeholder="Status" clearable style="width: 110px"><el-option v-for="(l, v) in ENTITY_STATUS" :key="v" :label="l" :value="v" /></el-select>
        <span class="spacer" />
        <el-button @click="download">Export CSV</el-button>
        <el-button v-can="'write'" type="primary" :icon="'Plus'" @click="edit(null)">Add company</el-button>
      </div>
      <el-table @sort-change="onSort" :data="rows" stripe>
        <el-table-column label="Company name" prop="name" sortable="custom" min-width="230"><template #default="{ row }"><span class="link" @click="router.push('/companies/' + row.id)">{{ row.name }}</span></template></el-table-column>
        <el-table-column label="Types" min-width="190"><template #default="{ row }"><el-tag v-for="type in companyTypes(row)" :key="type" size="small" style="margin-right: 4px">{{ COMPANY_TYPES[type] }}</el-tag></template></el-table-column>
        <el-table-column label="ABN" prop="abn" sortable="custom" width="140" />
        <el-table-column label="Contact" prop="contact" sortable="custom" width="130" />
        <el-table-column label="Phone" prop="phone" sortable="custom" width="130" />
        <el-table-column label="Address" prop="address" sortable="custom" min-width="200" show-overflow-tooltip />
        <el-table-column label="Drivers" prop="driverCount" sortable="custom" width="85" align="right"><template #default="{ row }">{{ count('drivers', row.id) }}</template></el-table-column>
        <el-table-column label="Vehicles" prop="vehicleCount" sortable="custom" width="90" align="right"><template #default="{ row }">{{ count('vehicles', row.id) }}</template></el-table-column>
        <el-table-column label="Devices" prop="deviceCount" sortable="custom" width="85" align="right"><template #default="{ row }">{{ count('devices', row.id) }}</template></el-table-column>
        <el-table-column label="Status" prop="status" sortable="custom" width="95"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[row.status] }}</el-tag></template></el-table-column>
        <el-table-column v-if="can('write')" label="Actions" width="180" fixed="right"><template #default="{ row }">
          <el-button link type="primary" @click="edit(row)">Edit</el-button>
          <el-button link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggle(row)">{{ row.status === 'active' ? 'Deactivate' : 'Activate' }}</el-button>
        </template></el-table-column>
      </el-table>
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
    <EntityDialog v-model="dlg" :title="current ? 'Edit company' : 'Add company'" :fields="companyFields(current)" :record="current" :defaults="{ ...DEFAULTS.companies, types: JSON.stringify(typeFilter === 'all' ? [] : [typeFilter]) }"
      @submit="(d) => upsert('companies', current, d)" />
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import Pager from '../components/Pager.vue'
import EntityDialog from '../components/EntityDialog.vue'
import { usePaged } from '../composables/paged'
import { exportCsv } from '../store/csv'
import { state, save, ENTITY_STATUS, COMPANY_TYPES, companyTypes } from '../store/db'
import { can } from '../store/api'
import { companyFields, DEFAULTS, upsert } from '../store/forms'

const router = useRouter(), route = useRoute()
const typeFilter = computed({ get: () => route.query.type || 'transport', set: (type) => router.replace({ path: '/companies', query: { type } }) })
const isTransportView = computed(() => typeFilter.value === 'transport')
const q = ref(''), status = ref('')
const counts = computed(() => {
  const m = {}
  for (const key of ['drivers', 'vehicles', 'devices']) {
    m[key] = new Map()
    for (const x of state[key]) m[key].set(x.companyId, (m[key].get(x.companyId) || 0) + 1)
  }
  return m
})
const count = (key, id) => counts.value[key].get(id) || 0
const filtered = computed(() => {
  const k = q.value.trim().toLowerCase()
  return state.companies.filter((c) => (typeFilter.value === 'all' || companyTypes(c).includes(typeFilter.value)) && (!status.value || c.status === status.value) &&
    (!k || [c.name, c.abn, c.contact].some((x) => (x || '').toLowerCase().includes(k))))
})
const { page, pageSize, rows, sorted, onSort, total } = usePaged(filtered, 20, {
  driverCount: (c) => count('drivers', c.id), vehicleCount: (c) => count('vehicles', c.id), deviceCount: (c) => count('devices', c.id)
})
function download() {
  exportCsv('companies', sorted.value.map((c) => ({ 'Company name': c.name, Types: companyTypes(c).map((t) => COMPANY_TYPES[t]).join('; '), ABN: c.abn, Contact: c.contact,
    Phone: c.phone, Address: c.address, Drivers: count('drivers', c.id), Vehicles: count('vehicles', c.id),
    Devices: count('devices', c.id), Status: ENTITY_STATUS[c.status] })))
}
const dlg = ref(false), current = ref(null)
function edit(row) { current.value = row; dlg.value = true }
async function toggle(row) {
  if (row.status === 'active') { try { await ElMessageBox.confirm(`Deactivate transport company "${row.name}"? Its drivers will not be able to start new jobs.`, 'Deactivate', { type: 'warning' }) } catch { return } }
  row.status = row.status === 'active' ? 'inactive' : 'active'
  save()
}
</script>
