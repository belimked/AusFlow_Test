<template>
  <div class="page" v-if="drv">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      {{ drv.name }}
      <el-tag :type="TAG[drv.status]">{{ DRIVER_STATUS[drv.status] }}</el-tag>
    </h2>
    <el-row :gutter="12">
      <el-col :span="8">
        <div class="card">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="Transport company"><span class="link" @click="router.push('/companies/' + drv.companyId)">{{ nameOf('companies', drv.companyId) }}</span></el-descriptions-item>
            <el-descriptions-item label="Phone">{{ drv.phone || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Username">{{ drv.account || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Registered">{{ fmtDate(drv.createdAt) }}</el-descriptions-item>
          </el-descriptions>
        </div>
        <div class="card">
          <h4 style="margin: 0 0 8px">Work summary <span class="muted">(all history)</span></h4>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="Days worked">{{ days.length }}</el-descriptions-item>
            <el-descriptions-item label="Pump-outs completed">{{ stats.jobs }}</el-descriptions-item>
            <el-descriptions-item label="Pump-outs per working day">{{ stats.jobsPerDay }}</el-descriptions-item>
            <el-descriptions-item label="Average pump-out duration">{{ fmtDur(stats.avgJob) }}</el-descriptions-item>
            <el-descriptions-item label="Average gap between steps">{{ fmtDur(stats.avgGap) }}</el-descriptions-item>
            <el-descriptions-item label="Average straight-line distance between steps">{{ fmtM(stats.avgHop) }}</el-descriptions-item>
            <el-descriptions-item label="Flagged pump-outs">
              <span :class="{ red: stats.flagged }">{{ stats.flagged }}</span>
              <span class="muted"> ({{ stats.flagLocation }} location, {{ stats.flagCapacity }} capacity, {{ stats.flagNoLocation }} no GPS)</span>
            </el-descriptions-item>
            <el-descriptions-item label="Transfers / unloads">{{ stats.transfers }} / {{ stats.unloads }}</el-descriptions-item>
          </el-descriptions>
          <div class="muted" style="font-size: 12px; margin-top: 6px">These figures are the inputs for a future driver score; nothing is scored yet.</div>
        </div>
      </el-col>
      <el-col :span="16">
        <div class="card">
          <div class="toolbar" style="margin-bottom: 8px">
            <el-select v-model="dayKey" placeholder="Day" filterable style="width: 260px">
              <el-option v-for="d in days" :key="d.key" :value="d.key" :label="`${d.label} · ${d.steps.length} steps`" />
            </el-select>
            <el-button :loading="routing" :disabled="!day || !routable" @click="planRoutes">{{ routed ? 'Routes planned' : 'Plan routes (OSRM)' }}</el-button>
            <span class="muted" style="font-size: 12px">Road route and drive time between consecutive steps, via OpenStreetMap routing.</span>
          </div>
          <MapView :markers="markers" :lines="lines" :height="340" />
          <div class="muted" style="font-size: 12px; margin-top: 6px">Numbered in order of the day · Green: pump-out · Blue: transfer · Purple: unload · Dashed: straight line, solid: planned road route</div>
        </div>
      </el-col>
    </el-row>

    <div class="card" v-if="day">
      <h4 style="margin: 0 0 8px">{{ day.label }} <span class="muted">· first start {{ fmtClock(day.first) }} · last end {{ fmtClock(day.last) }} · span {{ fmtDur(day.span) }}</span></h4>
      <el-table :data="day.steps" size="small" stripe>
        <el-table-column label="#" width="45"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
        <el-table-column label="Step" min-width="260">
          <template #default="{ row }">
            <el-tag size="small" :type="KIND_TAG[row.kind]" style="margin-right: 6px">{{ KIND_LABEL[row.kind] }}</el-tag>
            <span v-if="row.kind === 'pickup'" class="link" @click="router.push('/pickups/' + row.id)">{{ row.deviceId }}</span>
            {{ row.label }}
            <el-tag v-for="f in row.flags" :key="f" size="small" :type="f === 'nolocation' ? 'info' : 'danger'" style="margin-left: 4px">{{ FLAGS[f] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Start" width="80"><template #default="{ row }">{{ fmtClock(row.start) }}</template></el-table-column>
        <el-table-column label="End" width="80"><template #default="{ row }">{{ row.end ? fmtClock(row.end) : (row.kind === 'pickup' ? 'open' : '—') }}</template></el-table-column>
        <el-table-column label="Duration" width="90"><template #default="{ row }">{{ row.end && row.kind === 'pickup' ? fmtDur(row.end - row.start) : '—' }}</template></el-table-column>
        <el-table-column label="Position" width="170">
          <template #default="{ row }">
            <span v-if="row.startPos" class="mono" style="font-size: 12px">{{ row.startPos.lat.toFixed(5) }}, {{ row.startPos.lng.toFixed(5) }}</span>
            <span v-else class="muted">No GPS</span>
            <div v-if="row.kind === 'pickup' && row.distance != null" class="muted" style="font-size: 12px" :class="{ red: row.distance > 200 }">{{ fmtM(row.distance) }} from device</div>
          </template>
        </el-table-column>
        <el-table-column label="Gap to next" width="100"><template #default="{ row }">{{ row.next ? fmtDur(row.next.gap) : '—' }}</template></el-table-column>
        <el-table-column label="Straight line" width="100"><template #default="{ row }">{{ row.next ? fmtM(row.next.straight) : '—' }}</template></el-table-column>
        <el-table-column label="Drive (road)" width="150">
          <template #default="{ row }">
            <template v-if="row.next?.route">{{ fmtDur(row.next.route.durationS * 1000) }} · {{ fmtM(row.next.route.distanceM) }}</template>
            <span v-else-if="row.next?.route === null" class="muted">no route</span>
            <span v-else-if="row.next" class="muted">not planned</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="Idle" width="90">
          <template #default="{ row }">
            <span v-if="row.next?.route && row.next.gap != null" :class="{ red: row.next.gap - row.next.route.durationS * 1000 > 45 * 60e3 }">{{ fmtDur(Math.max(0, row.next.gap - row.next.route.durationS * 1000)) }}</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="muted" style="font-size: 12px; margin-top: 8px">
        Gap = next step start − this step end. Idle = gap − planned drive time (over 45 min shown in red).
        Day totals: gaps {{ fmtDur(day.totalGap) }} · straight line {{ fmtM(day.totalStraight) }}<template v-if="routed"> · road {{ fmtDur(day.totalDrive) }} / {{ fmtM(day.totalDriveM) }} · idle {{ fmtDur(day.totalIdle) }}</template>
      </div>
    </div>

    <div class="card">
      <h4 style="margin: 0 0 8px">Working days ({{ days.length }})</h4>
      <el-table :data="pagedDays" size="small" stripe @row-click="(d) => (dayKey = d.key)" style="cursor: pointer">
        <el-table-column label="Date" width="150"><template #default="{ row }">{{ row.label }}</template></el-table-column>
        <el-table-column label="Pump-outs" width="100" align="right"><template #default="{ row }">{{ row.jobs }}</template></el-table-column>
        <el-table-column label="Transfers" width="90" align="right"><template #default="{ row }">{{ row.transfers }}</template></el-table-column>
        <el-table-column label="Unloads" width="90" align="right"><template #default="{ row }">{{ row.unloads }}</template></el-table-column>
        <el-table-column label="First start" width="100"><template #default="{ row }">{{ fmtClock(row.first) }}</template></el-table-column>
        <el-table-column label="Last end" width="100"><template #default="{ row }">{{ fmtClock(row.last) }}</template></el-table-column>
        <el-table-column label="Span" width="90"><template #default="{ row }">{{ fmtDur(row.span) }}</template></el-table-column>
        <el-table-column label="Gaps total" width="100"><template #default="{ row }">{{ fmtDur(row.totalGap) }}</template></el-table-column>
        <el-table-column label="Straight line" width="110"><template #default="{ row }">{{ fmtM(row.totalStraight) }}</template></el-table-column>
        <el-table-column label="Flags" width="80" align="right"><template #default="{ row }"><span :class="{ red: row.flagged }">{{ row.flagged }}</span></template></el-table-column>
      </el-table>
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="days.length" />
    </div>
  </div>
  <el-empty v-else description="Driver not found" />
</template>
<script setup>
import { ref, computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import Pager from '../components/Pager.vue'
import { state, idx, nameOf, plateOf, fmtDate, fmtM, distanceM, DRIVER_STATUS } from '../store/db'
import { routeSteps } from '../store/routing'

const TAG = { pending: 'warning', active: 'success', inactive: 'info' }
const KIND_LABEL = { pickup: 'Pump-out', transfer: 'Transfer', unload: 'Unload' }
const KIND_TAG = { pickup: 'success', transfer: 'primary', unload: 'warning' }
const KIND_COLOR = { pickup: '#67c23a', transfer: '#409eff', unload: '#9b59b6' }
const FLAGS = { location: 'Location mismatch', capacity: 'Over capacity', nolocation: 'No location' }
const route = useRoute(), router = useRouter()
const drv = computed(() => idx.drivers.value.get(route.params.id))

const pos = (lat, lng) => (lat == null || lng == null ? null : { lat, lng })
const ms = (s) => (s ? new Date(s).getTime() : null)
const dayOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fmtClock = (t) => (t == null ? '—' : new Date(t).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }))
function fmtDur(v) {
  if (v == null || Number.isNaN(v)) return '—'
  const m = Math.round(v / 60e3)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`
}

// One step per pump-out (start → end) and per transfer / unload (instant event), in time order.
const steps = computed(() => {
  const id = drv.value?.id
  if (!id) return []
  const out = []
  for (const p of state.pickups) {
    if (p.driverId !== id || !p.startAt) continue
    const startPos = pos(p.startLat, p.startLng), endPos = pos(p.endLat, p.endLng) || startPos
    out.push({ kind: 'pickup', id: p.id, deviceId: p.deviceId, start: ms(p.startAt), end: ms(p.endAt), startPos, endPos, distance: p.distance, flags: p.flags || [],
      label: `${idx.devices.value.get(p.deviceId)?.aka || ''} · ${nameOf('locations', p.locationId)} · ${p.volume != null ? p.volume.toLocaleString() + ' L' : 'in progress'} · ${plateOf(p.vehicleId)}` })
  }
  for (const t of state.transfers) {
    if (t.driverId !== id || !t.at) continue
    const at = ms(t.at), p = pos(t.lat, t.lng)
    out.push({ kind: 'transfer', id: t.id, start: at, end: at, startPos: p, endPos: p, flags: [], label: `${(t.volume || 0).toLocaleString()} L from ${plateOf(t.fromVehicleId)} to ${plateOf(t.toVehicleId)}` })
  }
  for (const u of state.unloads) {
    if (u.driverId !== id || !u.at) continue
    const at = ms(u.at), p = pos(u.lat, u.lng)
    out.push({ kind: 'unload', id: u.id, start: at, end: at, startPos: p, endPos: p, flags: [], label: `${(u.volume || 0).toLocaleString()} L at ${nameOf('facilities', u.facilityId)} · ${plateOf(u.vehicleId)}` })
  }
  return out.sort((a, b) => a.start - b.start)
})

// Planned road legs, keyed by the first step's id; filled by "Plan routes".
const routes = reactive({})

const days = computed(() => {
  const groups = new Map()
  for (const s of steps.value) {
    const k = dayOf(s.start)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(s)
  }
  return [...groups].map(([key, list]) => {
    const dsteps = list.map((s) => ({ ...s, next: null }))
    let totalGap = 0, totalStraight = 0, totalDrive = 0, totalDriveM = 0, totalIdle = 0
    for (let i = 0; i < dsteps.length - 1; i++) {
      const a = dsteps[i], b = dsteps[i + 1]
      const gap = a.end != null ? b.start - a.end : null
      const straight = distanceM(a.endPos?.lat, a.endPos?.lng, b.startPos?.lat, b.startPos?.lng)
      const r = routes[a.id]
      a.next = { gap, straight, route: r }
      if (gap != null) totalGap += gap
      if (straight != null) totalStraight += straight
      if (r) { totalDrive += r.durationS * 1000; totalDriveM += r.distanceM; if (gap != null) totalIdle += Math.max(0, gap - r.durationS * 1000) }
    }
    const ends = dsteps.map((s) => s.end).filter((v) => v != null)
    const first = dsteps[0].start, last = ends.length ? Math.max(...ends) : null
    return {
      key, label: new Date(first).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), steps: dsteps,
      jobs: dsteps.filter((s) => s.kind === 'pickup' && s.end).length, transfers: dsteps.filter((s) => s.kind === 'transfer').length,
      unloads: dsteps.filter((s) => s.kind === 'unload').length, first, last, span: last != null ? last - first : null,
      totalGap, totalStraight, totalDrive, totalDriveM, totalIdle, flagged: dsteps.reduce((n, s) => n + (s.flags.length ? 1 : 0), 0)
    }
  }).sort((a, b) => b.key.localeCompare(a.key))
})

const dayKey = ref('')
watch(days, (list) => { if (!list.some((d) => d.key === dayKey.value)) dayKey.value = list[0]?.key || '' }, { immediate: true })
const day = computed(() => days.value.find((d) => d.key === dayKey.value))
const page = ref(1), pageSize = ref(20)
const pagedDays = computed(() => days.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

const routable = computed(() => day.value?.steps.some((s, i) => i < day.value.steps.length - 1 && s.endPos && day.value.steps[i + 1].startPos))
const routed = computed(() => !!day.value && day.value.steps.slice(0, -1).every((s) => s.id in routes))
const routing = ref(false)
async function planRoutes() {
  if (!day.value || routing.value) return
  routing.value = true
  try {
    await routeSteps(day.value.steps, (i, leg) => { routes[day.value.steps[i].id] = leg })
  } finally {
    routing.value = false
  }
}

const markers = computed(() => (day.value?.steps || []).flatMap((s, i) => (s.startPos ? [{ lat: s.startPos.lat, lng: s.startPos.lng, label: `${i + 1}. ${KIND_LABEL[s.kind]} ${fmtClock(s.start)}`, color: KIND_COLOR[s.kind], permanent: true }] : [])))
const lines = computed(() => {
  const list = day.value?.steps || [], out = []
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1]
    const r = routes[a.id]
    if (r) out.push(r.geometry)
    else if (a.endPos && b.startPos) out.push([[a.endPos.lat, a.endPos.lng], [b.startPos.lat, b.startPos.lng]])
  }
  return out
})

const stats = computed(() => {
  const all = steps.value, jobs = all.filter((s) => s.kind === 'pickup' && s.end)
  const gaps = [], hops = []
  for (const d of days.value) for (const s of d.steps) if (s.next) { if (s.next.gap != null) gaps.push(s.next.gap); if (s.next.straight != null) hops.push(s.next.straight) }
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const flag = (f) => jobs.filter((j) => j.flags.includes(f)).length
  return {
    jobs: jobs.length, jobsPerDay: days.value.length ? (jobs.length / days.value.length).toFixed(1) : '—',
    avgJob: avg(jobs.map((j) => j.end - j.start)), avgGap: avg(gaps), avgHop: avg(hops) == null ? null : Math.round(avg(hops)),
    flagged: jobs.filter((j) => j.flags.length).length, flagLocation: flag('location'), flagCapacity: flag('capacity'), flagNoLocation: flag('nolocation'),
    transfers: all.filter((s) => s.kind === 'transfer').length, unloads: all.filter((s) => s.kind === 'unload').length
  }
})
</script>
