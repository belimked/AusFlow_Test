<template>
  <div>
    <el-table @sort-change="onSort" :data="paged" stripe size="small">
      <el-table-column label="ID" prop="id" sortable="custom" width="86" />
      <el-table-column v-if="!hideCompany" label="Hauler" prop="companyId" sortable="custom" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ nameOf('companies', row.companyId) }}</template></el-table-column>
      <el-table-column label="Driver" prop="driverId" sortable="custom" width="110"><template #default="{ row }">{{ nameOf('drivers', row.driverId) }}</template></el-table-column>
      <el-table-column label="From vehicle" prop="fromVehicleId" sortable="custom" width="125"><template #default="{ row }"><span class="link" @click="router.push('/vehicles/' + row.fromVehicleId)">{{ plateOf(row.fromVehicleId) }}</span></template></el-table-column>
      <el-table-column label="To vehicle" prop="toVehicleId" sortable="custom" width="115"><template #default="{ row }"><span class="link" @click="router.push('/vehicles/' + row.toVehicleId)">{{ plateOf(row.toVehicleId) }}</span></template></el-table-column>
      <el-table-column label="Volume" prop="volume" sortable="custom" width="100" align="right"><template #default="{ row }">{{ fmtL(row.volume) }}</template></el-table-column>
      <el-table-column label="Time" prop="at" sortable="custom" width="136"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
      <el-table-column label="Location" min-width="150"><template #default="{ row }"><span class="mono muted">{{ row.lat?.toFixed(5) }}, {{ row.lng?.toFixed(5) }}</span></template></el-table-column>
      <el-table-column label="" width="85"><template #default="{ row }"><el-button link type="primary" @click="emit('view', row)">Details</el-button></template></el-table-column>
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

const props = defineProps({ rows: Array, hideCompany: Boolean })
const emit = defineEmits(['view'])
const router = useRouter()
const { page, pageSize, rows: paged, sorted, onSort, total } = usePaged(toRef(props, 'rows'), 20, { companyId: (r) => nameOf('companies', r.companyId), driverId: (r) => nameOf('drivers', r.driverId), fromVehicleId: (r) => plateOf(r.fromVehicleId), toVehicleId: (r) => plateOf(r.toVehicleId) })
</script>
