<template>
  <div>
    <el-table :data="paged" stripe size="small">
      <el-table-column prop="id" label="ID" width="86" />
      <el-table-column v-if="!hideCompany" label="Hauler" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ nameOf('companies', row.companyId) }}</template></el-table-column>
      <el-table-column label="Driver" width="110"><template #default="{ row }">{{ nameOf('drivers', row.driverId) }}</template></el-table-column>
      <el-table-column label="Vehicle" width="96"><template #default="{ row }"><span class="link" @click="router.push('/vehicles/' + row.vehicleId)">{{ plateOf(row.vehicleId) }}</span></template></el-table-column>
      <el-table-column v-if="!hideFacility" label="Treatment Facility" min-width="180" show-overflow-tooltip><template #default="{ row }"><span class="link" @click="router.push('/facilities/' + row.facilityId)">{{ nameOf('facilities', row.facilityId) }}</span></template></el-table-column>
      <el-table-column label="Volume" width="100" align="right"><template #default="{ row }">{{ fmtL(row.volume) }}</template></el-table-column>
      <el-table-column label="Time" width="136"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
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
const { page, pageSize, rows: paged, total } = usePaged(toRef(props, 'rows'))
</script>
