<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="f.q" placeholder="Search name / phone / username" clearable :prefix-icon="'Search'" style="width: 270px" />
        <el-select v-model="f.company" placeholder="Hauler" clearable filterable style="width: 240px"><el-option v-for="c in state.companies" :key="c.id" :label="c.name" :value="c.id" /></el-select>
        <el-radio-group v-model="f.status">
          <el-radio-button value="">All</el-radio-button>
          <el-radio-button v-for="(l, v) in DRIVER_STATUS" :key="v" :value="v">{{ l }}<template v-if="v === 'pending'"> ({{ pendingCount }})</template></el-radio-button>
        </el-radio-group>
        <span class="spacer" />
        <el-button type="primary" :icon="'Plus'" @click="edit(null)">Add driver</el-button>
      </div>
      <el-table @sort-change="onSort" :data="rows" stripe>
        <el-table-column label="Name" prop="name" sortable="custom" width="160" />
        <el-table-column label="Hauler" prop="companyId" sortable="custom" min-width="220"><template #default="{ row }"><span class="link" @click="router.push('/companies/' + row.companyId)">{{ nameOf('companies', row.companyId) }}</span></template></el-table-column>
        <el-table-column label="Phone" prop="phone" sortable="custom" width="140" />
        <el-table-column label="Username" prop="account" sortable="custom" width="140" />
        <el-table-column label="Registered" prop="createdAt" sortable="custom" width="120"><template #default="{ row }">{{ fmtDate(row.createdAt) }}</template></el-table-column>
        <el-table-column label="Jobs (14 days)" prop="jobCount" sortable="custom" width="145" align="right"><template #default="{ row }">{{ jobs.get(row.id) || 0 }}</template></el-table-column>
        <el-table-column label="Status" prop="status" sortable="custom" width="100"><template #default="{ row }"><el-tag size="small" :type="TAG[row.status]">{{ DRIVER_STATUS[row.status] }}</el-tag></template></el-table-column>
        <el-table-column label="Photos" width="90" align="center"><template #default="{ row }">
          <el-button link type="primary" :icon="'Picture'" @click="openPhotos(row)">{{ photoCounts[row.id] || 0 }}</el-button>
        </template></el-table-column>
        <el-table-column label="Actions" width="190" fixed="right"><template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button link type="success" @click="setStatus(row, 'active', 'approved')">Approve</el-button>
            <el-button link type="danger" @click="reject(row)">Reject</el-button>
          </template>
          <el-button v-else-if="row.status === 'active'" link type="danger" @click="setStatus(row, 'inactive', 'deactivated')">Deactivate</el-button>
          <el-button v-else link type="success" @click="setStatus(row, 'active', 'activated')">Activate</el-button>
          <el-button link type="primary" @click="edit(row)">Edit</el-button>
        </template></el-table-column>
      </el-table>
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
    <EntityDialog v-model="dlg" :title="current ? 'Edit driver' : 'Add driver'" :fields="driverFields(current)" :record="current"
      :defaults="{ ...DEFAULTS.drivers, companyId: f.company || undefined }" @submit="(d) => upsert('drivers', current, d)" />
    <el-dialog v-model="photoDlg" :title="`Photos & attachments — ${photoDriver?.name}`" width="720px" destroy-on-close>
      <EntityPhotos v-if="photoDriver" type="driver" :id="photoDriver.id" @count="(n) => (photoCounts[photoDriver.id] = n)" />
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import Pager from '../components/Pager.vue'
import EntityDialog from '../components/EntityDialog.vue'
import EntityPhotos from '../components/EntityPhotos.vue'
import { api } from '../store/api'
import { usePaged } from '../composables/paged'
import { state, save, nameOf, fmtDate, DRIVER_STATUS } from '../store/db'
import { driverFields, DEFAULTS, upsert } from '../store/forms'

const TAG = { pending: 'warning', active: 'success', inactive: 'info' }
const route = useRoute(), router = useRouter()
const f = reactive({ q: route.query.q || '', company: route.query.company || '', status: route.query.status || '' })
const pendingCount = computed(() => state.drivers.filter((d) => d.status === 'pending').length)
const jobs = computed(() => {
  const m = new Map()
  for (const p of state.pickups) m.set(p.driverId, (m.get(p.driverId) || 0) + 1)
  return m
})
const filtered = computed(() => {
  const k = f.q.trim().toLowerCase()
  return state.drivers.filter((d) => (!f.company || d.companyId === f.company) && (!f.status || d.status === f.status) &&
    (!k || [d.name, d.phone, d.account].some((x) => (x || '').toLowerCase().includes(k))))
})
const { page, pageSize, rows, sorted, onSort, total } = usePaged(filtered, 20, { jobCount: (d) => jobs.value.get(d.id) || 0, companyId: (d) => nameOf('companies', d.companyId) })
const dlg = ref(false), current = ref(null)
function edit(row) { current.value = row; dlg.value = true }
const photoCounts = reactive({})
const photoDlg = ref(false), photoDriver = ref(null)
function openPhotos(row) { photoDriver.value = row; photoDlg.value = true }
onMounted(async () => Object.assign(photoCounts, await api('/photos/counts?type=driver')))
function setStatus(row, status, msg) { row.status = status; save(); ElMessage.success(`${row.name}: ${msg}`) }
async function reject(row) {
  try { await ElMessageBox.confirm(`Reject the registration of ${row.name}? The account will be set to Inactive.`, 'Reject', { type: 'warning' }) } catch { return }
  setStatus(row, 'inactive', 'rejected')
}
</script>
