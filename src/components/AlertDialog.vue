<template>
  <el-dialog v-model="alertDrawer.open" width="980px" top="5vh" class="alert-dialog" destroy-on-close>
    <template #header>
      <div v-if="a" class="hd">
        <el-icon :size="20" :class="a.severity"><WarningFilled /></el-icon>
        <span class="mono aid">{{ a.alertId }}</span>
        <el-button link :icon="'CopyDocument'" title="Copy follow-up link" @click="copyLink" />
        <el-tag :type="SEV_TAG[a.severity]" effect="dark" size="small">{{ SEVERITY[a.severity] }}</el-tag>
        <el-tag size="small">{{ ALERT_CATEGORIES[a.category] }}</el-tag>
        <el-tag size="small" type="info">{{ ALERT_TYPES[a.type] }}</el-tag>
        <span style="flex: 1" />
        <el-tag :type="STATUS_TYPE[status]" effect="dark" round>{{ ALERT_STATUS[status] }}</el-tag>
      </div>
    </template>
    <div v-if="a">
      <h3 class="title">{{ a.title }}</h3>
      <div class="muted">{{ a.detail }} · {{ fmtTime(a.at) }}</div>

      <el-row :gutter="16" style="margin-top: 14px">
        <el-col :span="11">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item v-if="r.pickupId" label="Pump-out job"><span class="link mono" @click="go('/pickups/' + r.pickupId)">{{ r.pickupId }}</span>
              <span class="muted"> {{ fmtTime(pickup?.startAt) }}</span></el-descriptions-item>
            <el-descriptions-item v-if="r.pickupIds?.length" label="Source pump-outs"><div class="dev-list"><span v-for="id in r.pickupIds" :key="id" class="link mono" @click="go('/pickups/' + id)">{{ id }}</span></div></el-descriptions-item>
            <el-descriptions-item v-if="r.unloadId" label="Unload"><span class="link mono" @click="go({ path: '/trace', query: { unload: r.unloadId } })">{{ r.unloadId }}</span></el-descriptions-item>
            <el-descriptions-item v-if="r.facilityId" label="Facility"><span class="link" @click="go('/facilities/' + r.facilityId)">{{ nameOf('facilities', r.facilityId) }}</span></el-descriptions-item>
            <el-descriptions-item v-if="r.deviceId" label="Device"><span class="link mono" @click="go('/devices/' + r.deviceId)">{{ r.deviceId }}</span>
              <span class="muted"> {{ device?.aka }}</span></el-descriptions-item>
            <el-descriptions-item v-if="r.locationId" label="Location"><span class="link" @click="go('/locations/' + r.locationId)">{{ nameOf('locations', r.locationId) }}</span></el-descriptions-item>
            <el-descriptions-item label="Transport company">
              <span v-if="r.companyId" class="link" @click="go('/companies/' + r.companyId)">{{ nameOf('companies', r.companyId) }}</span><span v-else>—</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="r.vehicleId" label="Vehicle"><span class="link mono" @click="go('/vehicles/' + r.vehicleId)">{{ plateOf(r.vehicleId) }}</span></el-descriptions-item>
            <el-descriptions-item v-if="r.driverId" label="Driver">
              <span class="link" @click="go({ path: '/drivers', query: { q: nameOf('drivers', r.driverId), company: driver?.companyId } })">{{ nameOf('drivers', r.driverId) }}</span>
              <span class="muted"> {{ driver?.phone }}</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="r.deviceIds" :label="`Overdue devices (${r.deviceIds.length})`">
              <div class="dev-list"><span v-for="id in r.deviceIds" :key="id" class="link mono" @click="go('/devices/' + id)">{{ id }}</span></div>
              <span class="link" @click="go({ path: '/devices', query: { overdue: '1', company: r.companyId } })">Open in device list →</span>
            </el-descriptions-item>
            <el-descriptions-item label="Coordinates">
              <template v-if="a.points.length <= 6">
                <div v-for="p in a.points" :key="p.label" class="mono coord"><span class="dot" :style="{ background: p.color }" />{{ p.label }}: {{ p.lat.toFixed(6) }}, {{ p.lng.toFixed(6) }}</div>
              </template>
              <span v-else class="muted">{{ a.points.length }} positions shown on the map</span>
              <span v-if="!a.points.length" class="muted">No coordinates for this alert</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-col>
        <el-col :span="13">
          <MapView v-if="a.points.length" :markers="a.points" :height="260" />
          <el-empty v-else description="No coordinates" :image-size="60" style="height: 260px; padding: 0" />
        </el-col>
      </el-row>

      <el-row :gutter="16" style="margin-top: 16px">
        <el-col :span="12">
          <h4>Notes &amp; follow-up</h4>
          <template v-if="can('write')">
            <el-input v-model="text" type="textarea" :rows="3" placeholder="Add a note: action taken, who was contacted, next step…" />
            <div style="text-align: right; margin-top: 6px"><el-button type="primary" size="small" :disabled="!text.trim()" @click="addNote">Add note</el-button></div>
          </template>
          <el-timeline v-if="notes.length" style="margin-top: 8px; padding-left: 2px">
            <el-timeline-item v-for="n in notes" :key="n.id" :timestamp="`${fmtTime(n.at)} · ${n.user}`" :type="n.kind === 'status' ? 'primary' : ''" placement="top">
              <span v-if="n.kind === 'status'">Status changed to <b>{{ ALERT_STATUS[statusLabel(n.status)] }}</b></span>
              <span v-else class="note">{{ n.text }}</span>
            </el-timeline-item>
          </el-timeline>
          <div v-else class="muted" style="font-size: 12px; margin-top: 8px">No notes yet</div>
        </el-col>
        <el-col :span="12">
          <EntityPhotos :key="a.alertId" type="alert" :id="a.alertId" :kinds="{ photo: 'Photos & attachments' }" />
        </el-col>
      </el-row>
    </div>
    <template #footer>
      <div v-if="a && can('write')" class="ft">
        <span class="muted">Follow-up status</span>
        <el-button v-if="!['new', 'acknowledged'].includes(status)" @click="changeStatus('new')">Reopen</el-button>
        <el-button v-for="v in ['acknowledged', 'cleared', 'dismissed']" :key="v" :type="STATUS_TYPE[v]" :plain="status !== v" :icon="STATUS_ICON[v]"
          @click="status !== v && changeStatus(v)">{{ v === 'acknowledged' ? 'Acknowledge' : v === 'cleared' ? 'Clear' : 'Dismiss' }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { requestReason } from '../store/warningActions' 
import MapView from './MapView.vue'
import EntityPhotos from './EntityPhotos.vue'
import { idx, nameOf, plateOf, fmtTime } from '../store/db'
import { can } from '../store/api'
import { alertDrawer, ALERT_TYPES, ALERT_CATEGORIES, ALERT_STATUS, SEVERITY, statusOf, notesOf, addAlertNote, setAlertStatus } from '../store/alerts'

const SEV_TAG = { critical: 'danger', warning: 'warning', info: 'info' }
const STATUS_TYPE = { new: 'danger', acknowledged: 'warning', cleared: 'success', dismissed: 'info' }
const STATUS_ICON = { acknowledged: 'Clock', cleared: 'CircleCheck', dismissed: 'CircleClose' }
const statusLabel = (s) => ({ open: 'new', progress: 'acknowledged', resolved: 'cleared' })[s] || s
const router = useRouter()
const text = ref('')
const a = computed(() => alertDrawer.alert)
const r = computed(() => a.value?.refs || {})
const pickup = computed(() => idx.pickups.value.get(r.value.pickupId))
const device = computed(() => idx.devices.value.get(r.value.deviceId))
const driver = computed(() => idx.drivers.value.get(r.value.driverId))
const status = computed(() => statusOf(a.value.alertId))
const notes = computed(() => notesOf(a.value.alertId))

function go(to) {
  alertDrawer.open = false
  router.push(to)
}
function addNote() {
  addAlertNote(a.value.alertId, text.value.trim())
  text.value = ''
}
async function changeStatus(s) {
  const reason = ['cleared', 'dismissed'].includes(s) ? await requestReason(s === 'cleared' ? 'Clear' : 'Dismiss') : ''
  if (reason === null) return
  setAlertStatus(a.value.alertId, s, reason)
  ElMessage.success(`${a.value.alertId}: ${ALERT_STATUS[s]}`)
}
async function copyLink() {
  const url = `${location.origin}${location.pathname}#/alerts?alert=${a.value.alertId}`
  await navigator.clipboard?.writeText(url).catch(() => {})
  ElMessage.success('Link copied: ' + url)
}
</script>
<style scoped>
.hd { display: flex; align-items: center; gap: 8px; padding-right: 24px; }
.ft { display: flex; align-items: center; justify-content: flex-end; gap: 4px; border-top: 1px solid #ebeef5; padding-top: 12px; }
.ft .muted { margin-right: 8px; font-size: 13px; }
.hd .critical { color: #f56c6c; } .hd .warning { color: #e6a23c; } .hd .info { color: #909399; }
.aid { font-size: 17px; font-weight: 700; }
.title { margin: 0 0 4px; font-size: 17px; }
h4 { margin: 0 0 8px; }
.coord { font-size: 12px; line-height: 1.7; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.note { white-space: pre-wrap; }
.dev-list { display: flex; flex-wrap: wrap; gap: 4px 10px; max-height: 96px; overflow-y: auto; margin-bottom: 4px; font-size: 12px; }
</style>
