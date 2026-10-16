<template>
  <el-drawer :model-value="!!record" :title="record ? `${kind === 'transfer' ? 'Transfer' : 'Unload'} ${record.id}` : ''" size="520px" @close="emit('close')">
    <template v-if="record">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="Transport company">{{ nameOf('companies', record.companyId) }}</el-descriptions-item>
        <el-descriptions-item label="Driver">{{ nameOf('drivers', record.driverId) }}</el-descriptions-item>
        <template v-if="kind === 'transfer'">
          <el-descriptions-item label="From vehicle">{{ plateOf(record.fromVehicleId) }}</el-descriptions-item>
          <el-descriptions-item label="To vehicle">{{ plateOf(record.toVehicleId) }}</el-descriptions-item>
          <el-descriptions-item label="Volume">{{ fmtL(record.volume) }}</el-descriptions-item>
        </template>
        <template v-else>
          <el-descriptions-item label="Vehicle">{{ plateOf(record.vehicleId) }}</el-descriptions-item>
          <el-descriptions-item label="Treatment Facility">{{ nameOf('facilities', record.facilityId) }}</el-descriptions-item>
          <el-descriptions-item label="Waste type"><WasteType :text="record.waste" /></el-descriptions-item>
          <el-descriptions-item label="Collected">{{ fmtL(collected) }}</el-descriptions-item>
          <el-descriptions-item label="Delivered">{{ fmtL(record.volume) }}</el-descriptions-item>
          <el-descriptions-item label="Difference"><span :class="{ red: Math.abs(difference / collected) > 0.1 }">{{ fmtL(difference) }} ({{ collected ? (difference / collected * 100).toFixed(1) : '—' }}%)</span></el-descriptions-item>
        </template>
        <el-descriptions-item label="Time">{{ fmtTime(record.at) }}</el-descriptions-item>
        <el-descriptions-item label="Location">{{ record.lat?.toFixed(6) }}, {{ record.lng?.toFixed(6) }}</el-descriptions-item>
      </el-descriptions>
      <MapView :markers="[{ lat: record.lat, lng: record.lng, label: kind === 'transfer' ? 'Transfer location' : nameOf('facilities', record.facilityId), color: '#409eff', permanent: true }]" :height="260" style="margin-top: 12px" />
      <template v-if="kind === 'unload'">
        <el-button type="primary" style="margin-top: 12px" @click="router.push({ path: '/trace', query: { unload: record.id } })">Trace source devices</el-button>
        <OperationFollowup kind="unload" :id="record.id" />
      </template>
    </template>
  </el-drawer>
</template>
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import MapView from './MapView.vue'
import WasteType from './WasteType.vue'
import OperationFollowup from './OperationFollowup.vue'
import { nameOf, plateOf, fmtTime, fmtL, unloadSources } from '../store/db'

const props = defineProps({ record: Object, kind: String })
const collected = computed(() => props.record && props.kind === 'unload' ? unloadSources(props.record).reduce((n, p) => n + (Number(p.volume) || 0), 0) : 0)
const difference = computed(() => (Number(props.record?.volume) || 0) - collected.value)
const emit = defineEmits(['close'])
const router = useRouter()
</script>
