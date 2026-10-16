<template>
  <div class="page" v-if="dev">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      <span class="mono">{{ dev.ref }}</span> {{ dev.aka }}
      <el-tag :type="{ Active: 'success', Inactive: 'info', Removed: 'danger' }[dev.status]">{{ DEVICE_STATUS[dev.status] }}</el-tag>
      <el-tag v-if="isOverdue(dev)" type="danger" effect="dark">{{ overdueText(dev) }}</el-tag>
      <span style="flex: 1" />
      <el-button v-can="'write'" @click="tab = 'notes'; noteDialog = true">Add note</el-button>
      <el-button v-can="'write'" @click="tab = 'inspections'; inspectDialog = true">Inspect</el-button>
      <el-button v-can="'write'" :icon="'Edit'" @click="dlg = true">Edit</el-button>
      <el-dropdown v-can="'write'" @command="setStatus">
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
                <el-descriptions-item label="Tag ID" :span="2"><InlineField :device="dev" field="tags"><TagIds :device="dev" inline /></InlineField></el-descriptions-item>
                <el-descriptions-item label="Location" :span="2"><InlineField :device="dev" field="locationId"><span class="link" @click="router.push('/locations/' + dev.locationId)">{{ loc?.name }}</span>
                  <span class="muted" style="margin-left: 6px">{{ loc?.address1 }}, {{ loc?.suburb }}</span></InlineField></el-descriptions-item>
                <el-descriptions-item label="Service frequency"><InlineField :device="dev" field="freqWeeks">{{ dev.freqWeeks ? dev.freqWeeks + ' wk' : 'Not set' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Last service"><InlineField :device="dev" field="lastService">{{ fmtTime(dev.lastService) }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Next service"><span :class="{ red: isOverdue(dev) }">{{ fmtDate(nextService(dev)) }}</span></el-descriptions-item>
                <el-descriptions-item label="Overdue"><span class="red">{{ overdueText(dev) || (dev.status === 'Active' ? 'Not overdue' : '—') }}</span></el-descriptions-item>
                <el-descriptions-item label="Status"><InlineField :device="dev" field="status">{{ DEVICE_STATUS[dev.status] }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Device type"><InlineField :device="dev" field="type">{{ dev.type || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Waste type"><InlineField :device="dev" field="waste"><WasteType :text="dev.waste" /></InlineField></el-descriptions-item>
                <el-descriptions-item label="Capacity"><InlineField :device="dev" field="capacity">{{ fmtL(dev.capacity) }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Approval category"><InlineField :device="dev" field="approvalCategory">{{ dev.approvalCategory || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Risk rating"><InlineField :device="dev" field="risk">{{ dev.risk || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Responsible transport company" :span="2"><InlineField :device="dev" field="companyId">
                  <span v-if="dev.companyId" class="link" @click="router.push('/companies/' + dev.companyId)">{{ nameOf('companies', dev.companyId) }}</span><span v-else>—</span>
                </InlineField></el-descriptions-item>
                <el-descriptions-item label="Owner"><InlineField :device="dev" field="ownerId">
                  <span v-if="dev.ownerId" class="link" @click="router.push('/companies/' + dev.ownerId)">{{ nameOf('companies', dev.ownerId) }}</span><span v-else>—</span>
                </InlineField></el-descriptions-item>
                <el-descriptions-item label="Occupier"><span v-if="loc?.occupierId" class="link" @click="router.push('/companies/' + loc.occupierId)">{{ nameOf('companies', loc.occupierId) }}</span><span v-else>—</span></el-descriptions-item>
                <el-descriptions-item label="Location description" :span="2"><InlineField :device="dev" field="locationDesc">{{ dev.locationDesc || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Comments" :span="2"><InlineField :device="dev" field="comments">{{ dev.comments || '—' }}</InlineField></el-descriptions-item>
                <el-descriptions-item label="Coordinates" :span="2"><InlineField :device="dev" field="coords">{{ typeof dev.lat === 'number' && typeof dev.lng === 'number' ? `${dev.lat.toFixed(6)}, ${dev.lng.toFixed(6)}` : 'Not set' }}</InlineField></el-descriptions-item>
              </el-descriptions>
              <MapView :markers="markers" :height="220" style="margin-top: 12px" />
            </el-col>
            <el-col :span="9">
              <div style="text-align: center"><QrCode :value="tagsOf(dev)[0] || ''" :system-ref="dev.ref" :title="dev.ref + ' ' + (dev.aka || '')" :subtitle="loc?.name" :size="200"
                editable :validate="qrTaken" @change="setQr" /></div>
              <el-divider />
              <EntityPhotos type="device" :id="dev.id" :kinds="DEVICE_PHOTO_KINDS"
                @added="(k, name) => photoLog(k, '', 'Added ' + name)" @removed="(k, name) => photoLog(k, name, 'Removed')" />
            </el-col>
          </el-row>
        </el-tab-pane>
        <el-tab-pane label="History" name="service">
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
          <PickupHistory :rows="pickups" :device="dev" />
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
              <el-table-column label="Tag ID" width="138"><template #default="{ row }"><TagIds :device="row.d" /></template></el-table-column>
              <el-table-column label="Device name" min-width="180" show-overflow-tooltip><template #default="{ row }">{{ row.d.aka || '—' }}</template></el-table-column>
              <el-table-column label="Location" min-width="200" show-overflow-tooltip><template #default="{ row }">
                {{ nameOf('locations', row.d.locationId) }}<el-tag v-if="row.d.locationId === dev.locationId" size="small" style="margin-left: 6px">Same location</el-tag>
              </template></el-table-column>
              <el-table-column label="Type" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.d.type }}</template></el-table-column>
              <el-table-column label="Status" width="90"><template #default="{ row }">{{ DEVICE_STATUS[row.d.status] }}</template></el-table-column>
              <el-table-column label="Transport company" min-width="170" show-overflow-tooltip><template #default="{ row }">{{ row.d.companyId ? nameOf('companies', row.d.companyId) : '—' }}</template></el-table-column>
            </el-table>
          </template>
        </el-tab-pane>
        <el-tab-pane :label="`Notes (${notes.length})`" name="notes">
          <el-button v-can="'write'" type="primary" @click="noteDialog = true">Add note</el-button>
          <div v-for="n in notes" :key="n.id" style="padding: 10px; border-bottom: 1px solid #eee">{{ n.text }} <span class="muted">· {{ n.user }} · {{ n.source }} · {{ fmtTime(n.at) }}</span></div>
        </el-tab-pane>
        <el-tab-pane :label="`Inspections (${inspections.length})`" name="inspections">
          <el-button v-can="'write'" type="primary" @click="inspectDialog = true">Inspect</el-button>
          <el-table :data="inspections" row-key="id"><el-table-column type="expand"><template #default="{ row }"><EntityPhotos type="inspection" :id="row.id" /></template></el-table-column>
            <el-table-column label="Date" width="190"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
            <el-table-column prop="inspector" label="Inspector" /><el-table-column label="Result"><template #default="{ row }"><el-tag :type="row.result === 'compliant' ? 'success' : 'warning'">{{ INSPECTION_RESULTS[row.result] }}</el-tag></template></el-table-column>
            <el-table-column prop="comments" label="Comments" /><el-table-column prop="nextInspection" label="Next inspection" /><el-table-column prop="source" label="Source" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="`Reported Issues (${openIssues})`" name="issues">
          <el-table :data="issues" row-key="id"><el-table-column type="expand"><template #default="{ row }"><EntityPhotos type="issue" :id="row.id" readonly /></template></el-table-column>
            <el-table-column label="Category"><template #default="{ row }">{{ ISSUE_CATEGORIES[row.category] }}</template></el-table-column>
            <el-table-column prop="description" label="Description" /><el-table-column prop="reportedBy" label="Reported by" />
            <el-table-column label="Date"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
            <el-table-column label="Status"><template #default="{ row }"><el-tag :type="row.status === 'open' ? 'warning' : 'success'">{{ row.status }}</el-tag></template></el-table-column>
            <el-table-column label="Action"><template #default="{ row }"><el-button v-if="row.status === 'open' && can('write')" link type="primary" @click="resolve(row)">Resolve</el-button></template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="`Change Log (${logs.length})`" name="logs">
          <ChangeLogTable :rows="logs" hide-device />
        </el-tab-pane>
      </el-tabs>
    </div>
    <DeviceDialog v-model="dlg" :record="dev" />
    <el-dialog v-model="noteDialog" title="Add note" width="500px"><el-input v-model="noteText" type="textarea" /><template #footer><el-button @click="noteDialog = false">Cancel</el-button><el-button type="primary" :disabled="!noteText.trim()" @click="addNote">Save</el-button></template></el-dialog>
    <el-dialog v-model="inspectDialog" title="Inspect" width="550px">
      <el-form label-width="130px"><el-form-item label="Result" required><el-select v-model="inspection.result" style="width: 100%"><el-option v-for="(label, key) in INSPECTION_RESULTS" :key="key" :label="label" :value="key" /></el-select></el-form-item>
        <el-form-item label="Inspected at"><el-date-picker v-model="inspection.at" type="datetime" style="width: 100%" /></el-form-item>
        <el-form-item label="Inspector"><el-input v-model="inspection.inspector" /></el-form-item>
        <el-form-item label="Comments"><el-input v-model="inspection.comments" type="textarea" /></el-form-item>
        <el-form-item label="Next inspection"><el-date-picker v-model="inspection.nextInspection" type="date" clearable style="width: 100%" /></el-form-item>
        <p class="muted">Photos can be uploaded by expanding the saved inspection row.</p>
      </el-form><template #footer><el-button @click="inspectDialog = false">Cancel</el-button><el-button type="primary" :disabled="!inspection.result" @click="addInspection">Save</el-button></template>
    </el-dialog>
  </div>
  <el-empty v-else description="Device not found" />
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import MapView from '../components/MapView.vue'
import QrCode from '../components/QrCode.vue'
import DeviceDialog from '../components/DeviceDialog.vue'
import PickupHistory from '../components/PickupHistory.vue'
import ChangeLogTable from '../components/ChangeLogTable.vue'
import InlineField from '../components/InlineField.vue'
import TagIds from '../components/TagIds.vue'
import WasteType from '../components/WasteType.vue'
import EntityPhotos from '../components/EntityPhotos.vue'
import { tagsOf, state, idx, nameOf, updateDevice, logChange, addEntityNote, nextId, CURRENT_USER, INSPECTION_RESULTS, ISSUE_CATEGORIES, save, nextService, isOverdue, overdueText, distanceM, fmtDate, fmtTime, fmtL, fmtM, DEVICE_STATUS } from '../store/db'
import { can } from '../store/api'

const route = useRoute(), router = useRouter()
const tab = ref(route.query.tab || 'info')
const dev = computed(() => idx.devices.value.get(route.params.id))
const loc = computed(() => idx.locations.value.get(dev.value?.locationId))
const pickups = computed(() => state.pickups.filter((p) => p.deviceId === route.params.id))
const notes = computed(() => state.notes.filter((n) => n.entityType === 'device' && n.entityId === route.params.id))
const inspections = computed(() => state.inspections.filter((i) => i.deviceId === route.params.id))
const issues = computed(() => state.reportedIssues.filter((i) => i.deviceId === route.params.id))
const openIssues = computed(() => issues.value.filter((i) => i.status === 'open').length)
const noteDialog = ref(false), noteText = ref(''), inspectDialog = ref(false)
const inspection = ref({ result: '', at: new Date(), inspector: CURRENT_USER, comments: '', nextInspection: null })
function addNote() { if (!noteText.value.trim()) return; addEntityNote('device', dev.value.id, noteText.value); noteText.value = ''; noteDialog.value = false }
function addInspection() {
  if (!inspection.value.result) return
  state.inspections.unshift({ id: nextId('IN'), deviceId: dev.value.id, inspector: inspection.value.inspector,
    at: new Date(inspection.value.at || Date.now()).toISOString(), result: inspection.value.result,
    comments: inspection.value.comments, nextInspection: inspection.value.nextInspection ? new Date(inspection.value.nextInspection).toISOString().slice(0, 10) : null, source: 'Web' })
  logChange(dev.value.id, 'Inspection', '', INSPECTION_RESULTS[inspection.value.result], 'Web'); save()
  inspectDialog.value = false; inspection.value = { result: '', at: new Date(), inspector: CURRENT_USER, comments: '', nextInspection: null }
}
async function resolve(issue) {
  let text
  try { ({ value: text } = await ElMessageBox.prompt('Resolution explanation (required)', 'Resolve reported issue', { inputValidator: (v) => !!v?.trim() || 'Explanation is required' })) } catch { return }
  issue.status = 'resolved'; addEntityNote('device', dev.value.id, `Resolved ${ISSUE_CATEGORIES[issue.category]} (${issue.id}): ${text.trim()}`)
  logChange(dev.value.id, 'Reported issue', 'open', `Resolved ${issue.id}: ${text.trim()}`, 'Web'); save()
}
const logs = computed(() => state.changeLogs.filter((l) => l.deviceId === route.params.id))
const markers = computed(() => [
  ...(dev.value.lat != null ? [{ lat: dev.value.lat, lng: dev.value.lng, label: dev.value.ref, color: '#409eff', permanent: true }] : []),
  ...(loc.value?.lat != null ? [{ lat: loc.value.lat, lng: loc.value.lng, label: 'Location: ' + loc.value.name, color: '#e6a23c' }] : [])
])
const dlg = ref(false)
const DEVICE_PHOTO_KINDS = { device: 'Device photos', coords: 'Location / coordinates photos' }
const PHOTO_LOG_FIELD = { device: 'Device photo', coords: 'Location photo' }
function photoLog(kind, oldValue, newValue) {
  logChange(dev.value.id, PHOTO_LOG_FIELD[kind], oldValue, newValue, 'Web')
  save()
}

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
const qrTaken = (code) => {
  const other = state.devices.find((d) => d.id !== dev.value.id && tagsOf(d).some((t) => t.toLowerCase() === code.toLowerCase()))
  return other ? `Already used by device ${other.ref}` : ''
}
function setQr(code) {
  const [, ...rest] = tagsOf(dev.value)
  updateDevice(dev.value.id, { tags: [code, ...rest].join(' '), qr: code }, 'Web')
  ElMessage.success('QR code updated and recorded in the Change Log')
}
</script>
<style scoped>
.dev-info :deep(.el-descriptions__label) { width: 150px; }
.nearby-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
</style>
