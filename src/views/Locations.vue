<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="q" placeholder="Search name / address / agreement no." clearable :prefix-icon="'Search'" style="width: 320px" />
        <el-select v-model="suburb" placeholder="Suburb" clearable filterable style="width: 180px">
          <el-option v-for="s in suburbs" :key="s" :value="s" />
        </el-select>
        <el-select v-model="status" placeholder="Status" clearable style="width: 110px">
          <el-option v-for="(l, v) in ENTITY_STATUS" :key="v" :label="l" :value="v" />
        </el-select>
        <el-select v-model="custodian" placeholder="Custodian" clearable style="width: 170px"><el-option label="(Unspecified)" value="none" /><el-option v-for="(label, key) in CUSTODIAN" :key="key" :label="label" :value="key" /></el-select>
        <span class="spacer" />
        <el-button @click="download">Export CSV</el-button>
        <el-button type="primary" :icon="'Plus'" @click="edit(null)">Add Location</el-button>
      </div>
      <el-table @sort-change="onSort" :data="rows" stripe>
        <el-table-column label="Location name" prop="name" sortable="custom" min-width="220" show-overflow-tooltip>
          <template #default="{ row }"><span class="link" @click="router.push('/locations/' + row.id)">{{ row.name }}</span></template>
        </el-table-column>
        <el-table-column label="Address" prop="address1" sortable="custom" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ row.address1 }}</template></el-table-column>
        <el-table-column label="Suburb" prop="suburb" sortable="custom" width="150" />
        <el-table-column label="Owner" prop="owner" sortable="custom" min-width="160"><template #default="{ row }">{{ nameOf('companies', row.ownerId) }}</template></el-table-column>
        <el-table-column label="Occupier" prop="occupier" sortable="custom" min-width="160"><template #default="{ row }">{{ nameOf('companies', row.occupierId) }}</template></el-table-column>
        <el-table-column label="Custodian" prop="custodianCategory" sortable="custom" width="140"><template #default="{ row }">{{ CUSTODIAN[row.custodianCategory] || '(Unspecified)' }}</template></el-table-column>
        <el-table-column label="Agreement No." prop="agreementNo" sortable="custom" width="140" />
        <el-table-column label="Devices" prop="deviceCount" sortable="custom" width="90" align="right"><template #default="{ row }">{{ stats.get(row.id)?.n || 0 }}</template></el-table-column>
        <el-table-column label="Overdue" prop="overdueCount" sortable="custom" width="90" align="right"><template #default="{ row }"><span :class="{ red: stats.get(row.id)?.od }">{{ stats.get(row.id)?.od || 0 }}</span></template></el-table-column>
        <el-table-column label="Coordinates" width="115"><template #default="{ row }"><el-icon v-if="row.lat != null" color="#67c23a"><CircleCheck /></el-icon><span v-else class="muted">None</span></template></el-table-column>
        <el-table-column label="Status" prop="status" sortable="custom" width="100"><template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ ENTITY_STATUS[row.status] }}</el-tag></template></el-table-column>
        <el-table-column label="Actions" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row)">Edit</el-button>
            <el-button link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggle(row)">{{ row.status === 'active' ? 'Deactivate' : 'Activate' }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
    <LocationDialog v-model="dlg" :record="current" />
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import Pager from '../components/Pager.vue'
import LocationDialog from '../components/LocationDialog.vue'
import { usePaged } from '../composables/paged'
import { exportCsv } from '../store/csv'
import { state, save, nameOf, isOverdue, ENTITY_STATUS, CUSTODIAN } from '../store/db'

const router = useRouter()
const q = ref(''), suburb = ref(''), status = ref(''), custodian = ref('')
const suburbs = computed(() => [...new Set(state.locations.map((l) => l.suburb).filter(Boolean))].sort())
const stats = computed(() => {
  const m = new Map()
  for (const d of state.devices) {
    const s = m.get(d.locationId) || { n: 0, od: 0 }
    s.n++; if (isOverdue(d)) s.od++
    m.set(d.locationId, s)
  }
  return m
})
const filtered = computed(() => {
  const k = q.value.trim().toLowerCase()
  return state.locations.filter((l) =>
    (!k || [l.name, l.address1, l.agreementNo].some((x) => (x || '').toLowerCase().includes(k))) &&
    (!suburb.value || l.suburb === suburb.value) && (!status.value || l.status === status.value) &&
    (!custodian.value || (custodian.value === 'none' ? !l.custodianCategory : l.custodianCategory === custodian.value)))
})
const { page, pageSize, rows, sorted, onSort, total } = usePaged(filtered, 20, {
  owner: (l) => nameOf('companies', l.ownerId), occupier: (l) => nameOf('companies', l.occupierId),
  deviceCount: (l) => stats.value.get(l.id)?.n || 0, overdueCount: (l) => stats.value.get(l.id)?.od || 0
})
function download() {
  exportCsv('locations', sorted.value.map((l) => ({ 'Location name': l.name, Address: l.address1, Suburb: l.suburb, Owner: nameOf('companies', l.ownerId), Occupier: nameOf('companies', l.occupierId),
    'Agreement No.': l.agreementNo, Custodian: CUSTODIAN[l.custodianCategory] || '(Unspecified)', Devices: stats.value.get(l.id)?.n || 0, Overdue: stats.value.get(l.id)?.od || 0,
    Coordinates: l.lat != null && l.lng != null ? 'Set' : 'None', Status: ENTITY_STATUS[l.status] })))
}

const dlg = ref(false), current = ref(null)
function edit(row) { current.value = row; dlg.value = true }
async function toggle(row) {
  if (row.status === 'active') { try { await ElMessageBox.confirm(`Deactivate location “${row.name}”? Existing devices and records will not be affected.`, 'Deactivate Location', { type: 'warning' }) } catch { return } }
  row.status = row.status === 'active' ? 'inactive' : 'active'
  save()
}
</script>
