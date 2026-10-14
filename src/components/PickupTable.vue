<template>
  <div>
    <el-table :data="paged" stripe size="small">
      <el-table-column label="ID" width="86"><template #default="{ row }"><span class="link" @click="router.push('/pickups/' + row.id)">{{ row.id }}</span></template></el-table-column>
      <el-table-column v-if="!hideDevice" label="Device / Location" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><span class="link" @click="router.push('/devices/' + row.deviceId)">{{ row.deviceId }}</span> {{ nameOf('locations', row.locationId) }}</template>
      </el-table-column>
      <el-table-column v-if="!hideCompany" label="Hauler" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ nameOf('companies', row.companyId) }}</template></el-table-column>
      <el-table-column label="Driver" width="110" show-overflow-tooltip><template #default="{ row }">{{ nameOf('drivers', row.driverId) }}</template></el-table-column>
      <el-table-column v-if="!hideVehicle" label="Vehicle" width="86"><template #default="{ row }"><span class="link" @click="router.push('/vehicles/' + row.vehicleId)">{{ plateOf(row.vehicleId) }}</span></template></el-table-column>
      <el-table-column label="Volume" width="100" align="right"><template #default="{ row }">{{ fmtL(row.volume) }}</template></el-table-column>
      <el-table-column label="Time" width="136"><template #default="{ row }">{{ fmtTime(row.endAt || row.startAt) }}</template></el-table-column>
      <el-table-column label="Distance from device" width="155" align="right"><template #default="{ row }"><span :class="{ red: row.distance > 200 }">{{ fmtM(row.distance) }}</span></template></el-table-column>
      <el-table-column label="Flags / Status" min-width="180">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'ongoing'" size="small" type="warning">In progress</el-tag>
          <el-tag v-for="f in row.flags" :key="f" size="small" :type="FLAG_TAG[f]" style="margin-right: 4px">{{ FLAGS[f] }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
    <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
  </div>
</template>
<script setup>
import { toRef } from 'vue'
import { useRouter } from 'vue-router'
import Pager from './Pager.vue'
import { usePaged } from '../composables/paged'
import { nameOf, plateOf, fmtTime, fmtL, fmtM } from '../store/db'

const props = defineProps({ rows: Array, hideDevice: Boolean, hideCompany: Boolean, hideVehicle: Boolean })
const FLAGS = { location: 'Location mismatch', capacity: 'Over capacity', nolocation: 'No location' }
const FLAG_TAG = { location: 'danger', capacity: 'danger', nolocation: 'info' }
const router = useRouter()
const { page, pageSize, rows: paged, total } = usePaged(toRef(props, 'rows'))
</script>
