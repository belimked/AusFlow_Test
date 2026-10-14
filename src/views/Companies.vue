<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="q" placeholder="Search hauler / ABN / contact" clearable :prefix-icon="'Search'" style="width: 290px" />
        <el-select v-model="status" placeholder="Status" clearable style="width: 110px"><el-option v-for="(l, v) in ENTITY_STATUS" :key="v" :label="l" :value="v" /></el-select>
        <span class="spacer" />
        <el-button type="primary" :icon="'Plus'" @click="edit(null)">Add hauler</el-button>
      </div>
      <el-table :data="rows" stripe>
        <el-table-column label="Hauler name" min-width="230"><template #default="{ row }"><span class="link" @click="router.push('/companies/' + row.id)">{{ row.name }}</span></template></el-table-column>
        <el-table-column prop="abn" label="ABN" width="140" />
        <el-table-column prop="contact" label="Contact" width="130" />
        <el-table-column prop="phone" label="Phone" width="130" />
        <el-table-column prop="address" label="Address" min-width="200" show-overflow-tooltip />
        <el-table-column label="Drivers" width="85" align="right"><template #default="{ row }">{{ count('drivers', row.id) }}</template></el-table-column>
        <el-table-column label="Vehicles" width="90" align="right"><template #default="{ row }">{{ count('vehicles', row.id) }}</template></el-table-column>
        <el-table-column label="Devices" width="85" align="right"><template #default="{ row }">{{ count('devices', row.id) }}</template></el-table-column>
        <el-table-column label="Status" width="95"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[row.status] }}</el-tag></template></el-table-column>
        <el-table-column label="Actions" width="180" fixed="right"><template #default="{ row }">
          <el-button link type="primary" @click="edit(row)">Edit</el-button>
          <el-button link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggle(row)">{{ row.status === 'active' ? 'Deactivate' : 'Activate' }}</el-button>
        </template></el-table-column>
      </el-table>
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
    <EntityDialog v-model="dlg" :title="current ? 'Edit hauler' : 'Add hauler'" :fields="companyFields(current)" :record="current" :defaults="DEFAULTS.companies"
      @submit="(d) => upsert('companies', current, d)" />
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import Pager from '../components/Pager.vue'
import EntityDialog from '../components/EntityDialog.vue'
import { usePaged } from '../composables/paged'
import { state, save, ENTITY_STATUS } from '../store/db'
import { companyFields, DEFAULTS, upsert } from '../store/forms'

const router = useRouter()
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
  return state.companies.filter((c) => (!status.value || c.status === status.value) &&
    (!k || [c.name, c.abn, c.contact].some((x) => (x || '').toLowerCase().includes(k))))
})
const { page, pageSize, rows, total } = usePaged(filtered)
const dlg = ref(false), current = ref(null)
function edit(row) { current.value = row; dlg.value = true }
async function toggle(row) {
  if (row.status === 'active') await ElMessageBox.confirm(`Deactivate hauler "${row.name}"? Its drivers will not be able to start new jobs.`, 'Deactivate', { type: 'warning' })
  row.status = row.status === 'active' ? 'inactive' : 'active'
  save()
}
</script>
