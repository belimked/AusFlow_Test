<template>
  <div>
    <el-table @sort-change="onSort" :data="paged" stripe size="small">
      <el-table-column label="ID" prop="id" sortable="custom" width="86" />
      <el-table-column v-if="!hideCompany" label="Hauler" prop="companyId" sortable="custom" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ nameOf('companies', row.companyId) }}</template></el-table-column>
      <el-table-column label="Driver" prop="driverId" sortable="custom" width="110"><template #default="{ row }">{{ nameOf('drivers', row.driverId) }}</template></el-table-column>
      <el-table-column label="Vehicle" prop="vehicleId" sortable="custom" width="96"><template #default="{ row }"><span class="link" @click="router.push('/vehicles/' + row.vehicleId)">{{ plateOf(row.vehicleId) }}</span></template></el-table-column>
      <el-table-column v-if="!hideFacility" label="Treatment Facility" prop="facilityId" sortable="custom" min-width="180" show-overflow-tooltip><template #default="{ row }"><span class="link" @click="router.push('/facilities/' + row.facilityId)">{{ nameOf('facilities', row.facilityId) }}</span></template></el-table-column>
      <el-table-column label="Waste type" prop="waste" sortable="custom" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ row.waste || '—' }}</template></el-table-column>
      <el-table-column label="Volume" prop="volume" sortable="custom" width="100" align="right"><template #default="{ row }">{{ fmtL(row.volume) }}</template></el-table-column>
      <el-table-column label="Time" prop="at" sortable="custom" width="136"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
      <el-table-column label="" width="150"><template #default="{ row }">
        <el-button link type="primary" @click="emit('view', row)">Details</el-button>
        <el-button link type="primary" @click="router.push({ path: '/trace', query: { unload: row.id } })">Trace</el-button>
      </template></el-table-column>
    </el-table>
    <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
  </div>
</template>
<script setup>
import { toRef } from 'vue'
import { useRouter } from 'vue-router'
import Pager from './Pager.vue'
import { usePaged } from '../composables/paged'
import { nameOf, plateOf, fmtTime, fmtL } from '../store/db'

const props = defineProps({ rows: Array, hideCompany: Boolean, hideFacility: Boolean })
const emit = defineEmits(['view'])
const router = useRouter()
const { page, pageSize, rows: paged, sorted, onSort, total } = usePaged(toRef(props, 'rows'), 20, { companyId: (r) => nameOf('companies', r.companyId), driverId: (r) => nameOf('drivers', r.driverId), vehicleId: (r) => plateOf(r.vehicleId), facilityId: (r) => nameOf('facilities', r.facilityId) })
</script>
