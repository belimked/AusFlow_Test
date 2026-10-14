<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="f.q" placeholder="Search Ref / name / location / Tag ID" clearable :prefix-icon="'Search'" style="width: 320px" />
        <el-select v-model="f.status" placeholder="Status" clearable style="width: 120px">
          <el-option v-for="(l, v) in DEVICE_STATUS" :key="v" :label="l" :value="v" />
        </el-select>
        <el-select v-model="f.type" placeholder="Device type" clearable filterable style="width: 180px">
          <el-option v-for="t in types" :key="t" :value="t" />
        </el-select>
        <el-select v-model="f.company" placeholder="Responsible hauler" clearable filterable style="width: 220px">
          <el-option label="(Unassigned)" value="none" />
          <el-option v-for="c in state.companies" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-checkbox v-model="f.overdue" border>Overdue only</el-checkbox>
        <span class="spacer" />
        <el-button :icon="'Upload'" @click="router.push('/import')">CSV Import</el-button>
        <el-button type="primary" :icon="'Plus'" @click="openNew()">Add Device</el-button>
      </div>
      <div class="muted" style="margin-bottom: 8px">{{ filtered.length.toLocaleString() }} devices, <span class="red">{{ overdueCount }}</span> overdue</div>
      <DeviceTable :rows="filtered">
        <el-table-column label="Actions" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">Edit</el-button>
            <el-button v-if="row.status === 'Active'" link type="danger" @click="setStatus(row, 'Inactive')">Deactivate</el-button>
            <el-button v-else link type="success" @click="setStatus(row, 'Active')">Activate</el-button>
          </template>
        </el-table-column>
      </DeviceTable>
    </div>
    <DeviceDialog v-model="dlg" :record="current" :defaults="defaults" @saved="(ref) => !current && router.push('/devices/' + ref)" />
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import DeviceTable from '../components/DeviceTable.vue'
import DeviceDialog from '../components/DeviceDialog.vue'
import { state, nameOf, tagsOf, isOverdue, updateDevice, DEVICE_STATUS } from '../store/db'

const route = useRoute(), router = useRouter()
const f = reactive({ q: '', status: route.query.status || '', type: '', company: route.query.company || '', overdue: route.query.overdue === '1' })
const types = computed(() => [...new Set(state.devices.map((d) => d.type).filter(Boolean))].sort())
const filtered = computed(() => {
  const k = f.q.trim().toLowerCase()
  const tagKey = k.replace(/[\s-]/g, '')
  return state.devices.filter((d) =>
    (!f.status || d.status === f.status) && (!f.type || d.type === f.type) &&
    (!f.company || (f.company === 'none' ? !d.companyId : d.companyId === f.company)) &&
    (!f.overdue || isOverdue(d)) &&
    (!k || [d.ref, d.aka, nameOf('locations', d.locationId)].some((x) => (x || '').toLowerCase().includes(k)) ||
      (tagKey && tagsOf(d).some((t) => t.toLowerCase().includes(tagKey)))))
})
const overdueCount = computed(() => filtered.value.filter(isOverdue).length)

const dlg = ref(false), current = ref(null), defaults = ref(null)
function openNew(locationId) { current.value = null; defaults.value = locationId ? { locationId } : null; dlg.value = true }
function openEdit(row) { current.value = row; defaults.value = null; dlg.value = true }
async function setStatus(row, status) {
  if (status === 'Inactive') await ElMessageBox.confirm(`Deactivate device ${row.ref}? Overdue status will no longer be calculated.`, 'Deactivate Device', { type: 'warning' })
  updateDevice(row.id, { status }, 'Web')
  ElMessage.success('Updated and recorded in the Change Log')
}
onMounted(() => route.query.newAt && openNew(route.query.newAt))
</script>
