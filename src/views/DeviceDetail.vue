<template>
  <div class="page" v-if="dev">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      <span class="mono">{{ dev.ref }}</span> {{ dev.aka }}
      <el-tag :type="{ Active: 'success', Inactive: 'info', Removed: 'danger' }[dev.status]">{{ DEVICE_STATUS[dev.status] }}</el-tag>
      <el-tag v-if="isOverdue(dev)" type="danger" effect="dark">{{ overdueText(dev) }}</el-tag>
      <span style="flex: 1" />
      <el-button :icon="'Edit'" @click="dlg = true">Edit</el-button>
      <el-dropdown @command="setStatus">
        <el-button>Change status<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
        <template #dropdown><el-dropdown-menu>
          <el-dropdown-item v-for="(l, v) in DEVICE_STATUS" :key="v" :command="v" :disabled="v === dev.status">{{ l }}</el-dropdown-item>
        </el-dropdown-menu></template>
      </el-dropdown>
    </h2>
    <div class="card">
      <el-tabs v-model="tab">
        <el-tab-pane label="Basic information" name="info">
          <el-row :gutter="16">
            <el-col :span="15">
              <el-descriptions :column="2" border class="dev-info">
                <el-descriptions-item label="Device Ref">{{ dev.ref }}</el-descriptions-item>
                <el-descriptions-item label="Device Number">{{ dev.number || '—' }}</el-descriptions-item>
                <el-descriptions-item label="Device name" :span="2"><InlineField :device="dev" field="aka">{{ dev.aka || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Tag ID" :span="2"><InlineField :device="dev" field="tags">
                  <template v-if="tagList.length"><el-tag v-for="t in tagList" :key="t" class="mono tag-id" effect="plain">{{ t }}</el-tag></template><span v-else>—</span>
                </InlineField></el-descriptions-item>
                <el-descriptions-item label="Location" :span="2"><InlineField :device="dev" field="locationId"><span class="link" @click="router.push('/locations/' + dev.locationId)">{{ loc?.name }}</span>
                  <span class="muted" style="margin-left: 6px">{{ loc?.address1 }}, {{ loc?.suburb }}</span></InlineField></el-descriptions-item>
                <el-descriptions-item label="Status"><InlineField :device="dev" field="status">{{ DEVICE_STATUS[dev.status] }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Device type"><InlineField :device="dev" field="type">{{ dev.type || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Waste type"><InlineField :device="dev" field="waste">{{ dev.waste || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Capacity"><InlineField :device="dev" field="capacity">{{ fmtL(dev.capacity) }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Service frequency"><InlineField :device="dev" field="freqWeeks">{{ dev.freqWeeks ? dev.freqWeeks + ' wk' : 'Not set' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Last service"><InlineField :device="dev" field="lastService">{{ fmtTime(dev.lastService) }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Approval category"><InlineField :device="dev" field="approvalCategory">{{ dev.approvalCategory || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Risk rating"><InlineField :device="dev" field="risk">{{ dev.risk || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Responsible hauler" :span="2"><InlineField :device="dev" field="companyId">
                  <span v-if="dev.companyId" class="link" @click="router.push('/companies/' + dev.companyId)">{{ nameOf('companies', dev.companyId) }}</span><span v-else>—</span>
                </InlineField></el-descriptions-item>
                <el-descriptions-item label="Location description" :span="2"><InlineField :device="dev" field="locationDesc">{{ dev.locationDesc || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Comments" :span="2"><InlineField :device="dev" field="comments">{{ dev.comments || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Coordinates" :span="2"><InlineField :device="dev" field="coords">{{ dev.lat != null ? `${dev.lat.toFixed(6)}, ${dev.lng.toFixed(6)}` : 'Not set' }}</InlineField></el-descriptions-item>
              </el-descriptions>
              <MapView :markers="markers" :height="220" style="margin-top: 12px" />
            </el-col>
            <el-col :span="9">
              <div style="text-align: center"><QrCode :value="dev.qr" :title="dev.ref + ' ' + (dev.aka || '')" :subtitle="loc?.name" :size="200" /></div>
              <el-divider />
              <DevicePhotos :device-id="dev.id" />
            </el-col>
          </el-row>
        </el-tab-pane>
        <el-tab-pane label="Service dates" name="service">
          <el-descriptions :column="2" border style="max-width: 760px">
            <el-descriptions-item label="Last service">{{ fmtTime(dev.lastService) }}</el-descriptions-item>
            <el-descriptions-item label="Service frequency">{{ dev.freqWeeks ? dev.freqWeeks + ' wk (' + dev.freqWeeks * 7 + ' days)' : 'Not set' }}</el-descriptions-item>
            <el-descriptions-item label="Next service"><span :class="{ red: isOverdue(dev) }">{{ fmtDate(nextService(dev)) }}</span></el-descriptions-item>
            <el-descriptions-item label="Overdue"><span class="red">{{ overdueText(dev) || (dev.status === 'Active' ? 'Not overdue' : 'Not active – not calculated') }}</span></el-descriptions-item>
          </el-descriptions>
          <p class="muted">Rule: next service = last service + service frequency × 7 days. Only active devices can be overdue. Completing a pump-out updates the last service date to the job end time.</p>
          <h4>Service history</h4>
          <el-timeline style="max-width: 600px">
            <el-timeline-item v-for="p in pickups.filter((p) => p.status === 'done')" :key="p.id" :timestamp="fmtTime(p.endAt)">
              {{ nameOf('companies', p.companyId) }} · {{ nameOf('drivers', p.driverId) }} · Pump-out {{ fmtL(p.volume) }}
            </el-timeline-item>
            <el-timeline-item v-if="dev.lastService && !pickups.length" :timestamp="fmtTime(dev.lastService)">From imported data</el-timeline-item>
          </el-timeline>
        </el-tab-pane>
        <el-tab-pane :label="`Pump-outs (${pickups.length})`" name="pickups">
          <PickupTable :rows="pickups" hide-device />
        </el-tab-pane>
        <el-tab-pane :label="`Nearby (${nearby.length})`" name="nearby">
          <el-empty v-if="dev.lat == null" description="This device has no coordinates — set them to find nearby devices" />
          <template v-else>
            <div class="nearby-bar">
              Devices within
              <el-radio-group v-model="radius" size="small">
                <el-radio-button v-for="r in RADII" :key="r" :value="r">{{ fmtM(r) }}</el-radio-button>
              </el-radio-group>
              <span class="muted">{{ nearby.length }} found{{ nearby.length > NEARBY_MAX ? `, showing closest ${NEARBY_MAX}` : '' }}</span>
            </div>
            <MapView v-if="tab === 'nearby'" :markers="nearbyMarkers" :circle="{ lat: dev.lat, lng: dev.lng, radius }" :height="320" />
            <el-table :data="nearby.slice(0, NEARBY_MAX)" size="small" style="margin-top: 12px" empty-text="No other devices in this radius">
              <el-table-column label="Distance" width="100"><template #default="{ row }">{{ fmtM(row.distance) }}</template></el-table-column>
              <el-table-column label="Device Ref" width="120"><template #default="{ row }"><span class="link mono" @click="router.push('/devices/' + row.d.id)">{{ row.d.ref }}</span></template></el-table-column>
              <el-table-column label="Device name" min-width="180" show-overflow-tooltip><template #default="{ row }">{{ row.d.aka || '—' }}</template></el-table-column>
              <el-table-column label="Location" min-width="200" show-overflow-tooltip><template #default="{ row }">
                {{ nameOf('locations', row.d.locationId) }}<el-tag v-if="row.d.locationId === dev.locationId" size="small" style="margin-left: 6px">Same location</el-tag>
              </template></el-table-column>
              <el-table-column label="Type" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.d.type }}</template></el-table-column>
              <el-table-column label="Status" width="90"><template #default="{ row }">{{ DEVICE_STATUS[row.d.status] }}</template></el-table-column>
              <el-table-column label="Hauler" min-width="170" show-overflow-tooltip><template #default="{ row }">{{ row.d.companyId ? nameOf('companies', row.d.companyId) : '—' }}</template></el-table-column>
            </el-table>
          </template>
        </el-tab-pane>
        <el-tab-pane :label="`Change Log (${logs.length})`" name="logs">
          <ChangeLogTable :rows="logs" hide-device />
        </el-tab-pane>
      </el-tabs>
    </div>
    <DeviceDialog v-model="dlg" :record="dev" />
  </div>
  <el-empty v-else description="Device not found" />
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MapView from '../components/MapView.vue'
import QrCode from '../components/QrCode.vue'
import DeviceDialog from '../components/DeviceDialog.vue'
import PickupTable from '../components/PickupTable.vue'
import ChangeLogTable from '../components/ChangeLogTable.vue'
import InlineField from '../components/InlineField.vue'
import DevicePhotos from '../components/DevicePhotos.vue'
import { state, idx, nameOf, tagsOf, updateDevice, nextService, isOverdue, overdueText, distanceM, fmtDate, fmtTime, fmtL, fmtM, DEVICE_STATUS } from '../store/db'

const route = useRoute(), router = useRouter()
const tab = ref(route.query.tab || 'info')
const dev = computed(() => idx.devices.value.get(route.params.id))
const loc = computed(() => idx.locations.value.get(dev.value?.locationId))
const pickups = computed(() => state.pickups.filter((p) => p.deviceId === route.params.id))
const logs = computed(() => state.changeLogs.filter((l) => l.deviceId === route.params.id))
const markers = computed(() => [
  ...(dev.value.lat != null ? [{ lat: dev.value.lat, lng: dev.value.lng, label: dev.value.ref, color: '#409eff', permanent: true }] : []),
  ...(loc.value?.lat != null ? [{ lat: loc.value.lat, lng: loc.value.lng, label: 'Location: ' + loc.value.name, color: '#e6a23c' }] : [])
])
const dlg = ref(false)
const tagList = computed(() => tagsOf(dev.value))

const RADII = [100, 250, 500, 1000, 2000]
const NEARBY_MAX = 50
const radius = ref(250)
const nearby = computed(() => {
  const d0 = dev.value
  if (!d0 || d0.lat == null) return []
  return state.devices
    .filter((d) => d.id !== d0.id && d.lat != null)
    .map((d) => ({ d, distance: distanceM(d0.lat, d0.lng, d.lat, d.lng) }))
    .filter((x) => x.distance <= radius.value)
    .sort((a, b) => a.distance - b.distance)
})
const nearbyMarkers = computed(() => [
  ...nearby.value.slice(0, NEARBY_MAX).map(({ d, distance }) => ({
    lat: d.lat, lng: d.lng, label: `${d.ref} ${d.aka || ''} · ${fmtM(distance)}`,
    color: d.status === 'Active' ? '#67c23a' : '#909399'
  })),
  { lat: dev.value.lat, lng: dev.value.lng, label: dev.value.ref + ' (this device)', color: '#409eff', permanent: true }
])
function setStatus(s) {
  updateDevice(dev.value.id, { status: s }, 'Web')
  ElMessage.success('Status updated and recorded in the Change Log')
}
</script>
<style scoped>
.dev-info :deep(.el-descriptions__label) { width: 150px; }
.tag-id { margin: 0 6px 2px 0; }
.nearby-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
</style>
