<template>
  <div>
    <el-table @sort-change="onSort" :data="paged" stripe size="small">
      <el-table-column label="ID" prop="id" sortable="custom" width="86"><template #default="{ row }"><span class="link" @click="router.push('/pickups/' + row.id)">{{ row.id }}</span></template></el-table-column>
      <el-table-column v-if="!hideDevice" label="Device / Location" prop="deviceId" sortable="custom" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><span class="link" @click="router.push('/devices/' + row.deviceId)">{{ row.deviceId }}</span> {{ nameOf('locations', row.locationId) }}</template>
      </el-table-column>
      <el-table-column v-if="!hideCompany" label="Hauler" prop="companyId" sortable="custom" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ nameOf('companies', row.companyId) }}</template></el-table-column>
      <el-table-column label="Driver" prop="driverId" sortable="custom" width="110" show-overflow-tooltip><template #default="{ row }">{{ nameOf('drivers', row.driverId) }}</template></el-table-column>
      <el-table-column v-if="!hideVehicle" label="Vehicle" prop="vehicleId" sortable="custom" width="86"><template #default="{ row }"><span class="link" @click="router.push('/vehicles/' + row.vehicleId)">{{ plateOf(row.vehicleId) }}</span></template></el-table-column>
      <el-table-column label="Waste type" prop="waste" sortable="custom" min-width="150" show-overflow-tooltip><template #default="{ row }"><WasteType :text="row.waste" /></template></el-table-column>
      <el-table-column label="Delivery status" prop="deliveryStatus" sortable="custom" width="145"><template #default="{ row }">{{ pickupDeliveries.get(row.id)?.status }}</template></el-table-column>
      <el-table-column label="Destination" prop="destination" sortable="custom" min-width="190"><template #default="{ row }"><span v-if="pickupDeliveries.get(row.id)?.facilityId" class="link" @click="router.push('/facilities/' + pickupDeliveries.get(row.id).facilityId)">{{ nameOf('facilities', pickupDeliveries.get(row.id).facilityId) }}</span><span v-else>Pending ({{ plateOf(pickupDeliveries.get(row.id)?.vehicleId) }})</span></template></el-table-column>
      <el-table-column label="Volume" prop="volume" sortable="custom" width="100" align="right"><template #default="{ row }">{{ fmtL(row.volume) }}</template></el-table-column>
      <el-table-column label="Time" prop="endAt" sortable="custom" width="136"><template #default="{ row }">{{ fmtTime(row.endAt || row.startAt) }}</template></el-table-column>
      <el-table-column label="Distance from device" prop="distance" sortable="custom" width="155" align="right"><template #default="{ row }"><span :class="{ red: row.distance > 200 }">{{ fmtM(row.distance) }}</span></template></el-table-column>
      <el-table-column label="Warnings" prop="warnings" sortable="custom" width="100"><template #default="{ row }"><el-badge :value="warnCount(row.id)" :hidden="!warnCount(row.id)" /></template></el-table-column>
      <el-table-column label="Flags / Status" prop="status" sortable="custom" min-width="180">
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
import { toRef, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import Pager from './Pager.vue'
import WasteType from './WasteType.vue'
import { usePaged } from '../composables/paged'
import { nameOf, plateOf, fmtTime, fmtL, fmtM, pickupDeliveries } from '../store/db'
import { warningsFor, isActive } from '../store/alerts'

const props = defineProps({ rows: Array, hideDevice: Boolean, hideCompany: Boolean, hideVehicle: Boolean })
const FLAGS = { location: 'Location mismatch', capacity: 'Over capacity', nolocation: 'No location' }
const FLAG_TAG = { location: 'danger', capacity: 'danger', nolocation: 'info' }
const router = useRouter()
const warnCount = (id) => warningsFor('pickup', id).filter(isActive).length
const { page, pageSize, rows: paged, sorted, onSort, total } = usePaged(toRef(props, 'rows'), 20, {
  endAt: (p) => p.endAt || p.startAt, companyId: (p) => nameOf('companies', p.companyId),
  driverId: (p) => nameOf('drivers', p.driverId), vehicleId: (p) => plateOf(p.vehicleId), warnings: (p) => warnCount(p.id),
  deliveryStatus: (p) => pickupDeliveries.value.get(p.id)?.status,
  destination: (p) => nameOf('facilities', pickupDeliveries.value.get(p.id)?.facilityId)
})
const emit = defineEmits(['sorted'])
watchEffect(() => emit('sorted', sorted.value))
</script>
