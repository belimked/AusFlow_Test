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
              <el-descriptions :column="2" border>
                <el-descriptions-item label="Device Ref">{{ dev.ref }}</el-descriptions-item>
                <el-descriptions-item label="Device Number">{{ dev.number || '—' }}</el-descriptions-item>
                <el-descriptions-item label="Location" :span="2"><span class="link" @click="router.push('/locations/' + dev.locationId)">{{ loc?.name }}</span>
                  <span class="muted"> {{ loc?.address1 }}, {{ loc?.suburb }}</span></el-descriptions-item>
                <el-descriptions-item label="Device type">{{ dev.type }}</el-descriptions-item>
                <el-descriptions-item label="Waste type">{{ dev.waste || '—' }}</el-descriptions-item>
                <el-descriptions-item label="Capacity">{{ fmtL(dev.capacity) }}</el-descriptions-item>
                <el-descriptions-item label="Service frequency">{{ dev.freqWeeks ? dev.freqWeeks + ' wk' : 'Not set' }}</el-descriptions-item>
                <el-descriptions-item label="Approval category">{{ dev.approvalCategory || '—' }}</el-descriptions-item>
                <el-descriptions-item label="Risk rating">{{ dev.risk || '—' }}</el-descriptions-item>
                <el-descriptions-item label="Responsible hauler" :span="2">
                  <span v-if="dev.companyId" class="link" @click="router.push('/companies/' + dev.companyId)">{{ nameOf('companies', dev.companyId) }}</span><span v-else>—</span>
                </el-descriptions-item>
                <el-descriptions-item label="Location description" :span="2">{{ dev.locationDesc || '—' }}</el-descriptions-item>
                <el-descriptions-item label="Comments" :span="2">{{ dev.comments || '—' }}</el-descriptions-item>
                <el-descriptions-item label="Coordinates" :span="2">{{ dev.lat != null ? `${dev.lat.toFixed(6)}, ${dev.lng.toFixed(6)}` : 'Not set' }}</el-descriptions-item>
              </el-descriptions>
              <MapView :markers="markers" :height="220" style="margin-top: 12px" />
            </el-col>
            <el-col :span="9" style="text-align: center">
              <QrCode :value="dev.qr" :title="dev.ref + ' ' + (dev.aka || '')" :subtitle="loc?.name" :size="200" />
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
import { state, idx, nameOf, updateDevice, nextService, isOverdue, overdueText, fmtDate, fmtTime, fmtL, DEVICE_STATUS } from '../store/db'

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
function setStatus(s) {
  updateDevice(dev.value.id, { status: s }, 'Web')
  ElMessage.success('Status updated and recorded in the Change Log')
}
</script>
