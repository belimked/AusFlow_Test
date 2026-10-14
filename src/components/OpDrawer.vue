<template>
  <el-drawer :model-value="!!record" :title="record ? `${kind === 'transfer' ? 'Transfer' : 'Unload'} ${record.id}` : ''" size="520px" @close="emit('close')">
    <template v-if="record">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="Hauler">{{ nameOf('companies', record.companyId) }}</el-descriptions-item>
        <el-descriptions-item label="Driver">{{ nameOf('drivers', record.driverId) }}</el-descriptions-item>
        <template v-if="kind === 'transfer'">
          <el-descriptions-item label="From vehicle">{{ plateOf(record.fromVehicleId) }}</el-descriptions-item>
          <el-descriptions-item label="To vehicle">{{ plateOf(record.toVehicleId) }}</el-descriptions-item>
          <el-descriptions-item label="Volume">{{ fmtL(record.volume) }}</el-descriptions-item>
        </template>
        <template v-else>
          <el-descriptions-item label="Vehicle">{{ plateOf(record.vehicleId) }}</el-descriptions-item>
          <el-descriptions-item label="Treatment Facility">{{ nameOf('facilities', record.facilityId) }}</el-descriptions-item>
          <el-descriptions-item label="Volume">{{ fmtL(record.volume) }}</el-descriptions-item>
        </template>
        <el-descriptions-item label="Time">{{ fmtTime(record.at) }}</el-descriptions-item>
        <el-descriptions-item label="Location">{{ record.lat?.toFixed(6) }}, {{ record.lng?.toFixed(6) }}</el-descriptions-item>
      </el-descriptions>
      <MapView :markers="[{ lat: record.lat, lng: record.lng, label: kind === 'transfer' ? 'Transfer location' : nameOf('facilities', record.facilityId), color: '#409eff', permanent: true }]" :height="260" style="margin-top: 12px" />
      <el-button v-if="kind === 'unload'" type="primary" style="margin-top: 12px" @click="router.push({ path: '/trace', query: { unload: record.id } })">Trace source devices</el-button>
    </template>
  </el-drawer>
</template>
<script setup>
import { useRouter } from 'vue-router'
import MapView from './MapView.vue'
import { nameOf, plateOf, fmtTime, fmtL } from '../store/db'

defineProps({ record: Object, kind: String })
const emit = defineEmits(['close'])
const router = useRouter()
</script>
