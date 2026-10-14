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
            <el-descriptions-item label="Hauler">{{ nameOf('companies', p.companyId) }}</el-descriptions-item>
            <el-descriptions-item label="Driver">{{ nameOf('drivers', p.driverId) }}</el-descriptions-item>
            <el-descriptions-item label="Vehicle"><span class="link" @click="router.push('/vehicles/' + p.vehicleId)">{{ plateOf(p.vehicleId) }}</span></el-descriptions-item>
            <el-descriptions-item label="Volume">{{ fmtL(p.volume) }} <span class="muted">(device capacity {{ fmtL(dev?.capacity) }})</span></el-descriptions-item>
            <el-descriptions-item label="Start">{{ fmtTime(p.startAt) }}</el-descriptions-item>
            <el-descriptions-item label="End">{{ p.endAt ? fmtTime(p.endAt) : `Not finished (${((Date.now() - new Date(p.startAt)) / 36e5).toFixed(1)} h elapsed)` }}</el-descriptions-item>
            <el-descriptions-item label="Distance from device"><span :class="{ red: p.distance > 200 }">{{ fmtM(p.distance) }}</span> <span class="muted">(phone vs. registered device location; over 200 m is flagged)</span></el-descriptions-item>
            <el-descriptions-item label="Notes">{{ p.note || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Photos">
              <div v-if="p.photos" style="display: flex; gap: 8px">
                <el-image v-for="i in p.photos" :key="i" :src="photo(i)" :preview-src-list="[photo(i)]" style="width: 96px; height: 72px; border-radius: 4px" />
              </div>
              <span v-else class="muted">No photos</span>
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
  </div>
  <el-empty v-else description="Record not found" />
</template>
<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import TraceSteps from '../components/TraceSteps.vue'
import { idx, nameOf, plateOf, fmtTime, fmtL, fmtM } from '../store/db'

const FLAGS = { location: 'Location mismatch', capacity: 'Over capacity', nolocation: 'No location' }
const route = useRoute(), router = useRouter()
const p = computed(() => idx.pickups.value.get(route.params.id))
const dev = computed(() => idx.devices.value.get(p.value?.deviceId))
const markers = computed(() => [
  ...(dev.value?.lat != null ? [{ lat: dev.value.lat, lng: dev.value.lng, label: 'Device ' + dev.value.ref, color: '#e6a23c' }] : []),
  { lat: p.value.startLat, lng: p.value.startLng, label: 'Start ' + fmtTime(p.value.startAt), color: '#67c23a' },
  { lat: p.value.endLat, lng: p.value.endLng, label: 'End ' + fmtTime(p.value.endAt), color: '#f56c6c' }
])
const photo = (i) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="100%" height="100%" fill="${i === 1 ? '#6b7f8e' : '#8a7a5c'}"/>` +
  `<text x="50%" y="50%" fill="#fff" font-size="22" text-anchor="middle" font-family="sans-serif">${i === 1 ? 'Before' : 'After'} · sample photo</text></svg>`)
</script>
