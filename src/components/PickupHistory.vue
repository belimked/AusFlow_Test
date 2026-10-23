<template>
  <div>
    <div class="bar">
      <span class="muted">{{ sorted.length }} pump-out job(s), newest first</span>
      <span style="flex: 1" />
      <el-button size="small" link type="primary" @click="open = sorted.map((p) => p.id)">Expand all</el-button>
      <el-button size="small" link type="primary" @click="open = []">Collapse all</el-button>
    </div>
    <el-empty v-if="!sorted.length" description="No pump-out jobs for this device" :image-size="60" />
    <el-collapse v-model="open">
      <el-collapse-item v-for="p in sorted" :key="p.id" :name="p.id">
        <template #title>
          <div class="row">
            <span class="mono id">{{ p.id }}</span>
            <span class="when">{{ fmtTime(p.startAt) }}</span>
            <el-tag size="small" :type="p.status === 'done' ? 'success' : 'warning'">{{ p.status === 'done' ? 'Completed' : 'In progress' }}</el-tag>
            <span class="vol">{{ fmtL(p.volume) }}</span>
            <span class="muted ellip">{{ nameOf('drivers', p.driverId) }} · {{ plateOf(p.vehicleId) }} · {{ nameOf('companies', p.companyId) }}</span>
            <span style="flex: 1" />
            <el-tag v-for="f in p.flags" :key="f" size="small" :type="f === 'nolocation' ? 'info' : 'danger'" effect="plain">{{ FLAGS[f] }}</el-tag>
            <el-tag v-if="p.status === 'done'" size="small" :type="flow(p).finished ? 'success' : 'warning'" effect="plain">
              {{ flow(p).finished ? 'Unloaded' : 'On board' }}
            </el-tag>
          </div>
        </template>
        <el-row v-if="open.includes(p.id)" :gutter="16">
          <el-col :span="13">
            <el-timeline class="steps">
              <el-timeline-item :timestamp="fmtTime(p.startAt)" placement="top" type="success" :icon="'VideoPlay'" size="large">
                <b>Start job</b>
                <div class="d">Driver <span class="link" @click="goDriver(p.driverId)">{{ nameOf('drivers', p.driverId) }}</span> ·
                  vehicle <span class="link mono" @click="router.push('/vehicles/' + p.vehicleId)">{{ plateOf(p.vehicleId) }}</span> ·
                  <span class="link" @click="router.push('/companies/' + p.companyId)">{{ nameOf('companies', p.companyId) }}</span></div>
                <div class="d mono">{{ coord(p.startLat, p.startLng) }}</div>
              </el-timeline-item>
              <el-timeline-item v-if="p.status === 'done'" :timestamp="fmtTime(p.endAt)" placement="top" type="primary" :icon="'CircleCheck'" size="large">
                <b>End job</b> · pumped out <b>{{ fmtL(p.volume) }}</b>
                <span class="muted"> ({{ minutes(p.startAt, p.endAt) }} min)</span>
                <div class="d mono">{{ coord(p.endLat, p.endLng) }}<span v-if="p.distance != null" :class="{ red: p.distance > 200 }"> · {{ fmtM(p.distance) }} from device</span></div>
                <div v-if="p.note" class="d">Note: {{ p.note }}</div>
                <div class="d">{{ p.photos ? p.photos + ' photo(s)' : 'No photos' }} ·
                  <span class="link" @click="router.push('/pickups/' + p.id)">Open job details →</span></div>
              </el-timeline-item>
              <el-timeline-item v-else :timestamp="`${hours(p.startAt)} h elapsed`" placement="top" type="warning" :icon="'Timer'" size="large" hollow>
                <b>Job not finished yet</b>
              </el-timeline-item>
              <template v-if="p.status === 'done'">
                <el-timeline-item v-for="h in flow(p).hops.filter((x) => x.kind === 'transfer')" :key="h.ref.id" :timestamp="fmtTime(h.at)" placement="top" color="#3fb1e3" :icon="'Van'" size="large">
                  <b>Transfer to large truck</b>
                  <span class="muted mono ref">{{ h.ref.id }}</span>
                  <div class="d"><span class="link mono" @click="router.push('/vehicles/' + h.ref.fromVehicleId)">{{ plateOf(h.ref.fromVehicleId) }}</span> →
                    <span class="link mono" @click="router.push('/vehicles/' + h.ref.toVehicleId)">{{ plateOf(h.ref.toVehicleId) }}</span> · load {{ fmtL(h.ref.volume) }}</div>
                  <div class="d mono">{{ coord(h.ref.lat, h.ref.lng) }}</div>
                </el-timeline-item>
                <el-timeline-item v-if="unloadOf(p)" :timestamp="fmtTime(unloadOf(p).at)" placement="top" color="#8e5bd8" :icon="'OfficeBuilding'" size="large">
                  <b>Emptied at</b> <span class="link" @click="router.push('/facilities/' + unloadOf(p).facilityId)">{{ nameOf('facilities', unloadOf(p).facilityId) }}</span>
                  <span class="muted mono ref">{{ unloadOf(p).id }}</span>
                  <div class="d">Vehicle <span class="link mono" @click="router.push('/vehicles/' + unloadOf(p).vehicleId)">{{ plateOf(unloadOf(p).vehicleId) }}</span> · unloaded {{ fmtL(unloadOf(p).volume) }}</div>
                </el-timeline-item>
                <el-timeline-item v-else timestamp="Pending" placement="top" :icon="'MoreFilled'" size="large" hollow>
                  <b>Not unloaded yet</b>
                  <div class="d">Still on vehicle <span class="link mono" @click="router.push('/vehicles/' + lastVehicle(p))">{{ plateOf(lastVehicle(p)) }}</span></div>
                </el-timeline-item>
              </template>
            </el-timeline>
          </el-col>
          <el-col :span="11">
            <MapView :markers="points(p)" :lines="lines(p)" :height="260" />
            <div class="muted legend">Orange: device · Green: start · Red: end · Blue: transfer · Purple: facility</div>
          </el-col>
        </el-row>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import MapView from './MapView.vue'
import { idx, nameOf, plateOf, traceForward, fmtTime, fmtL, fmtM } from '../store/db'

const props = defineProps({ rows: { type: Array, required: true }, device: Object })
const router = useRouter()
const FLAGS = { location: 'Location mismatch', capacity: 'Over capacity', nolocation: 'No location' }
const sorted = computed(() => [...props.rows].sort((a, b) => b.startAt.localeCompare(a.startAt)))
const open = ref(sorted.value.length ? [sorted.value[0].id] : [])

const flows = computed(() => new Map(sorted.value.map((p) => [p.id, p.status === 'done' ? traceForward(p) : { hops: [{ kind: 'pickup', vehicleId: p.vehicleId }], finished: false }])))
const flow = (p) => flows.value.get(p.id)
const unloadOf = (p) => flow(p).hops.find((h) => h.kind === 'unload')?.ref
const lastVehicle = (p) => flow(p).hops.at(-1).vehicleId
const coord = (lat, lng) => lat != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'No GPS position'
const minutes = (a, b) => Math.round((new Date(b) - new Date(a)) / 6e4)
const hours = (a) => ((Date.now() - new Date(a)) / 36e5).toFixed(1)
const goDriver = (id) => router.push({ path: '/drivers', query: { q: nameOf('drivers', id), company: idx.drivers.value.get(id)?.companyId } })

function points(p) {
  const out = []
  if (props.device?.lat != null) out.push({ lat: props.device.lat, lng: props.device.lng, label: 'Device ' + props.device.ref, color: '#e6a23c' })
  if (p.startLat != null) out.push({ lat: p.startLat, lng: p.startLng, label: 'Start', color: '#67c23a' })
  if (p.endLat != null) out.push({ lat: p.endLat, lng: p.endLng, label: 'End', color: '#f56c6c' })
  if (p.status !== 'done') return out
  for (const h of flow(p).hops) {
    if (h.kind === 'transfer' && h.ref.lat != null) out.push({ lat: h.ref.lat, lng: h.ref.lng, label: 'Transfer → ' + plateOf(h.ref.toVehicleId), color: '#3fb1e3' })
    if (h.kind === 'unload') {
      const f = idx.facilities.value.get(h.ref.facilityId)
      if (f?.lat != null) out.push({ lat: f.lat, lng: f.lng, label: f.name, color: '#8e5bd8' })
    }
  }
  return out
}
function lines(p) {
  const pts = points(p).filter((x) => x.color !== '#e6a23c' && x.color !== '#67c23a')
  return pts.slice(1).map((b, i) => ({ path: [[pts[i].lat, pts[i].lng], [b.lat, b.lng]], label: `${pts[i].label} → ${b.label}` }))
}
</script>
<style scoped>
.bar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.row { display: flex; align-items: center; gap: 10px; width: 100%; padding-right: 8px; min-width: 0; }
.id { font-weight: 600; color: #1f2d3d; }
.when { color: #303133; }
.vol { font-weight: 600; min-width: 70px; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.steps { padding: 6px 0 0 4px; }
.d { font-size: 12px; color: #606266; margin-top: 3px; }
.legend { font-size: 11px; margin-top: 4px; }
.ref { margin-left: 8px; font-size: 12px; }
</style>
