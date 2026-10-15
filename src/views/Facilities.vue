<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="q" placeholder="Search name / address" clearable :prefix-icon="'Search'" style="width: 260px" />
        <span class="spacer" />
        <el-button @click="download">Export CSV</el-button>
        <el-button type="primary" :icon="'Plus'" @click="edit(null)">Add Treatment Facility</el-button>
      </div>
      <el-row :gutter="12">
        <el-col :span="15">
          <el-table @sort-change="onSort" :data="sortedFacilities" stripe>
            <el-table-column label="Name" prop="name" sortable="custom" min-width="220"><template #default="{ row }"><span class="link" @click="router.push('/facilities/' + row.id)">{{ row.name }}</span></template></el-table-column>
            <el-table-column label="Address" prop="address" sortable="custom" min-width="220" show-overflow-tooltip />
            <el-table-column label="Unloaded (14 days)" prop="volume" sortable="custom" width="170" align="right"><template #default="{ row }">{{ fmtL(volumes.get(row.id) || 0) }}</template></el-table-column>
            <el-table-column label="Status" prop="status" sortable="custom" width="90"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[row.status] }}</el-tag></template></el-table-column>
            <el-table-column label="Actions" width="175"><template #default="{ row }">
              <el-button link type="primary" @click="edit(row)">Edit</el-button>
              <el-button link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggle(row)">{{ row.status === 'active' ? 'Deactivate' : 'Activate' }}</el-button>
            </template></el-table-column>
          </el-table>
        </el-col>
        <el-col :span="9"><MapView :markers="markers" :height="360" /></el-col>
      </el-row>
    </div>
    <EntityDialog v-model="dlg" :title="current ? 'Edit Treatment Facility' : 'Add Treatment Facility'" :fields="facilityFields(current)" :record="current" :defaults="DEFAULTS.facilities"
      @submit="(d) => upsert('facilities', current, d)" />
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { exportCsv } from '../store/csv'
import { usePaged } from '../composables/paged'
import MapView from '../components/MapView.vue'
import EntityDialog from '../components/EntityDialog.vue'
import { state, save, fmtL, ENTITY_STATUS } from '../store/db'
import { facilityFields, DEFAULTS, upsert } from '../store/forms'

const router = useRouter()
function download() {
  exportCsv('facilities', sortedFacilities.value.map((f) => ({ Name: f.name, Address: f.address,
    'Unloaded (14 days)': fmtL(volumes.value.get(f.id) || 0), Status: ENTITY_STATUS[f.status] })))
}
const q = ref('')
const filtered = computed(() => {
  const k = q.value.trim().toLowerCase()
  return state.facilities.filter((f) => !k || [f.name, f.address].some((x) => (x || '').toLowerCase().includes(k)))
})
const { sorted: sortedFacilities, onSort } = usePaged(filtered, 1000000, { volume: (f) => volumes.value.get(f.id) || 0 })
const volumes = computed(() => {
  const m = new Map()
  for (const u of state.unloads) if (Date.now() - new Date(u.at).getTime() <= 14 * 864e5) m.set(u.facilityId, (m.get(u.facilityId) || 0) + u.volume)
  return m
})
const markers = computed(() => filtered.value.map((f) => ({ lat: f.lat, lng: f.lng, label: f.name, color: f.status === 'active' ? '#67c23a' : '#909399' })))
const dlg = ref(false), current = ref(null)
function edit(row) { current.value = row; dlg.value = true }
function toggle(row) { row.status = row.status === 'active' ? 'inactive' : 'active'; save() }
</script>
