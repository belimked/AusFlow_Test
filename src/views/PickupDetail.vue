<template>
  <div class="page" v-if="p">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      Pump-out job <span class="mono">{{ p.id }}</span>
      <el-tag :type="p.status === 'done' ? 'success' : 'warning'">{{ p.status === 'done' ? 'Completed' : 'In progress' }}</el-tag>
      <el-tag v-for="f in p.flags" :key="f" :type="f === 'nolocation' ? 'info' : 'danger'">{{ FLAGS[f] }}</el-tag>
    </h2>
    <el-row :gutter="12">
      <el-col :span="12">
        <div class="card">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="Device"><span class="link" @click="router.push('/devices/' + p.deviceId)">{{ p.deviceId }}</span> {{ dev?.aka }}</el-descriptions-item>
            <el-descriptions-item label="Location"><span class="link" @click="router.push('/locations/' + p.locationId)">{{ nameOf('locations', p.locationId) }}</span></el-descriptions-item>
            <el-descriptions-item label="Transport company">{{ nameOf('companies', p.companyId) }}</el-descriptions-item>
            <el-descriptions-item label="Driver">{{ nameOf('drivers', p.driverId) }}</el-descriptions-item>
            <el-descriptions-item label="Vehicle"><span class="link" @click="router.push('/vehicles/' + p.vehicleId)">{{ plateOf(p.vehicleId) }}</span></el-descriptions-item>
            <el-descriptions-item label="Waste type"><WasteType :text="p.waste" /></el-descriptions-item>
            <el-descriptions-item label="Delivery status">{{ delivery?.status }}</el-descriptions-item>
            <el-descriptions-item label="Destination"><span v-if="delivery?.facilityId" class="link" @click="router.push('/facilities/' + delivery.facilityId)">{{ nameOf('facilities', delivery.facilityId) }}</span><span v-else>Pending ({{ plateOf(delivery?.vehicleId) }})</span></el-descriptions-item>
            <el-descriptions-item v-if="delivery?.unload" label="Delivered (estimated)">{{ fmtL(estimate) }} <span class="muted">pro-rata estimate</span></el-descriptions-item>
            <el-descriptions-item label="Volume">{{ fmtL(p.volume) }} <span class="muted">(device capacity {{ fmtL(dev?.capacity) }})</span></el-descriptions-item>
            <el-descriptions-item label="Start">{{ fmtTime(p.startAt) }}</el-descriptions-item>
            <el-descriptions-item label="End">{{ p.endAt ? fmtTime(p.endAt) : `Not finished (${((Date.now() - new Date(p.startAt)) / 36e5).toFixed(1)} h elapsed)` }}</el-descriptions-item>
            <el-descriptions-item label="Distance from device"><span :class="{ red: p.distance > 200 }">{{ fmtM(p.distance) }}</span> <span class="muted">(phone vs. registered device location; over 200 m is flagged)</span></el-descriptions-item>
            <el-descriptions-item label="Notes">{{ p.note || '—' }}</el-descriptions-item>
            <el-descriptions-item v-if="p.plannedFacilityId" label="Planned destination">
              <span class="link" @click="router.push('/facilities/' + p.plannedFacilityId)">{{ nameOf('facilities', p.plannedFacilityId) }}</span> <span class="muted">(chosen by the driver)</span>
            </el-descriptions-item>
            <el-descriptions-item label="Photos">
              <!-- Taken in the driver app; stored through /photos with type "pickup". -->
              <EntityPhotos type="pickup" :id="p.id" readonly :kinds="{ before: 'Before', after: 'After', photo: 'Other photos' }" />
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card">
          <MapView :markers="markers" :circle="dev?.lat != null ? { lat: dev.lat, lng: dev.lng, radius: 200 } : null" :height="300" />
          <div class="muted" style="font-size: 12px; margin-top: 6px">Orange: registered device location (blue circle = 200 m) · Green: start · Red: end</div>
        </div>
        <div class="card" v-if="p.status === 'done'">
          <h4 style="margin: 0 0 8px">Waste flow</h4>
          <TraceSteps :pickup="p" />
        </div>
      </el-col>
    </el-row>
    <OperationFollowup kind="pickup" :id="p.id" :app-note="p.note" />
  </div>
  <el-empty v-else description="Record not found" />
</template>
<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import WasteType from '../components/WasteType.vue'
import EntityPhotos from '../components/EntityPhotos.vue'
import TraceSteps from '../components/TraceSteps.vue'
import OperationFollowup from '../components/OperationFollowup.vue'
import { idx, nameOf, plateOf, fmtTime, fmtL, fmtM, pickupDeliveries, unloadSources } from '../store/db'

const FLAGS = { location: 'Location mismatch', capacity: 'Over capacity', nolocation: 'No location' }
const route = useRoute(), router = useRouter()
const p = computed(() => idx.pickups.value.get(route.params.id))
const delivery = computed(() => pickupDeliveries.value.get(p.value?.id))
const estimate = computed(() => {
  const u = delivery.value?.unload
  if (!u) return null
  const collected = unloadSources(u).reduce((sum, source) => sum + (Number(source.volume) || 0), 0)
  return collected ? Math.round(p.value.volume * u.volume / collected) : null
})
const dev = computed(() => idx.devices.value.get(p.value?.deviceId))
const markers = computed(() => [
  ...(dev.value?.lat != null ? [{ lat: dev.value.lat, lng: dev.value.lng, label: 'Device ' + dev.value.ref, color: '#e6a23c' }] : []),
  { lat: p.value.startLat, lng: p.value.startLng, label: 'Start ' + fmtTime(p.value.startAt), color: '#67c23a' },
  { lat: p.value.endLat, lng: p.value.endLng, label: 'End ' + fmtTime(p.value.endAt), color: '#f56c6c' }
])
</script>
