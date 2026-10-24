<template>
  <div class="page" v-if="drv">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      {{ drv.name }}
      <el-tag :type="TAG[drv.status]">{{ DRIVER_STATUS[drv.status] }}</el-tag>
    </h2>
    <div class="top-row">
      <div class="card profile">
        <div class="pf-head">
          <span class="pf-avatar">{{ initials }}</span>
          <div><b>{{ drv.name }}</b><span class="link" @click="router.push('/companies/' + drv.companyId)">{{ nameOf('companies', drv.companyId) }}</span></div>
        </div>
        <dl class="pf-list">
          <div><dt>Phone</dt><dd class="mono">{{ drv.phone || '—' }}</dd></div>
          <div><dt>Username</dt><dd class="mono">{{ drv.account || '—' }}</dd></div>
          <div><dt>Registered</dt><dd class="mono">{{ fmtDate(drv.createdAt) }}</dd></div>
          <div><dt>Status</dt><dd>{{ DRIVER_STATUS[drv.status] }}</dd></div>
        </dl>
      </div>
      <div class="card">
        <h4 style="margin: 0 0 8px">Work summary <span class="muted">(all history)</span></h4>
        <div class="stat-grid">
          <div v-for="s in summaryTiles" :key="s.label" class="stat" :class="s.tone" :title="s.hint">
            <small>{{ s.label }}</small><b class="mono">{{ s.value }}</b>
          </div>
        </div>
        <div class="muted" style="font-size: 12px; margin-top: 6px">These figures are the inputs for a future driver score; nothing is scored yet.</div>
      </div>
    </div>

    <div class="work-row">
      <div class="card">
        <div class="days-head">
          <h4 style="margin: 0">Working days ({{ range ? `${filteredDays.length} / ${days.length}` : days.length }}) <span class="muted" style="font-weight: normal; font-size: 12px">· click a day for its map and log</span></h4>
          <el-date-picker v-model="range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="From" end-placeholder="To" size="small" style="width: 240px; flex: none" />
        </div>
        <el-table :data="pagedDays" size="small" :max-height="480" @row-click="openDay" :row-class-name="({ row }) => (row.key === dayKey ? 'current-day' : '')" class="days-table">
          <el-table-column label="Date" width="130"><template #default="{ row }"><span class="link">{{ row.label }}</span></template></el-table-column>
          <el-table-column label="Jobs (P · T · U)" width="115"><template #default="{ row }"><span class="mono" title="Pump-outs · transfers · unloads">{{ row.jobs }} · {{ row.transfers }} · {{ row.unloads }}</span></template></el-table-column>
          <el-table-column label="Time" width="125">
            <template #default="{ row }"><div class="mono">{{ fmtClock(row.first) }}–{{ fmtClock(row.last) }}</div><div class="muted sub">{{ fmtDur(row.span) }}</div></template>
          </el-table-column>
          <el-table-column label="Gaps" width="85"><template #default="{ row }">{{ fmtDur(row.totalGap) }}</template></el-table-column>
          <el-table-column label="Distance" width="85"><template #default="{ row }">{{ fmtM(row.totalStraight) }}</template></el-table-column>
          <el-table-column label="Flags" min-width="130">
            <template #default="{ row }">
              <div class="flags">
                <el-tag v-if="row.noGps" size="small" type="warning">{{ row.noGps }} no GPS</el-tag>
                <el-tooltip v-if="row.slow" placement="top" :content="`${row.slow} leg(s) where the time to the next step is far longer than the drive should take. Click the day to see which.`"><el-tag size="small" type="danger" style="cursor: help">{{ row.slow }} slow</el-tag></el-tooltip>
                <el-tag v-if="row.other" size="small" type="danger">{{ row.other }} mismatch</el-tag>
                <span v-if="!row.noGps && !row.slow && !row.other" class="muted">—</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <Pager v-model:page="page" v-model:page-size="pageSize" :total="filteredDays.length" />
      </div>
      <div class="card map-card">
        <div class="toolbar" style="margin-bottom: 8px; flex-wrap: nowrap">
          <el-select v-model="dayKey" placeholder="Day" filterable style="flex: 1; min-width: 0">
            <el-option v-for="d in days" :key="d.key" :value="d.key" :label="`${d.label} · ${d.steps.length} steps`" />
          </el-select>
          <el-button :loading="routing" :disabled="!day || !routable" @click="planRoutes">{{ routed ? 'Routes planned' : 'Plan routes (OSRM)' }}</el-button>
        </div>
        <MapView :markers="markers" :lines="lines" :height="500" />
        <div class="muted" style="font-size: 12px; margin-top: 6px">Numbered in order of the day · Green: pump-out · Blue: transfer · Purple: unload · Dashed: straight line, solid: road route (OSRM) · each leg has its own colour, hover a line to see which</div>
      </div>
    </div>

    <div class="card" v-if="day" ref="dayCard">
      <h4 style="margin: 0 0 8px">{{ day.label }} <span class="muted">· first start {{ fmtClock(day.first) }} · last end {{ fmtClock(day.last) }} · span {{ fmtDur(day.span) }}</span></h4>
      <el-table :data="day.steps" size="small" stripe>
        <el-table-column label="#" width="45"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
        <el-table-column label="Step" min-width="260">
          <template #default="{ row }">
            <el-tag size="small" :type="KIND_TAG[row.kind]" style="margin-right: 6px">{{ KIND_LABEL[row.kind] }}</el-tag>
            <span v-if="row.kind === 'pickup'" class="link" @click="router.push('/pickups/' + row.id)">{{ row.deviceId }}</span>
            {{ row.label }}
            <el-tag v-for="f in row.flags" :key="f" size="small" :type="f === 'nogps' ? 'warning' : 'danger'" style="margin-left: 4px">{{ FLAGS[f] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Start" width="70"><template #default="{ row }">{{ fmtClock(row.start) }}</template></el-table-column>
        <el-table-column label="End" width="70"><template #default="{ row }">{{ row.end ? fmtClock(row.end) : (row.kind === 'pickup' ? 'open' : '—') }}</template></el-table-column>
        <el-table-column label="Duration" width="85"><template #default="{ row }">{{ row.end && row.kind === 'pickup' ? fmtDur(row.end - row.start) : '—' }}</template></el-table-column>
        <el-table-column label="Position" width="170">
          <template #default="{ row }">
            <span v-if="row.startPos" class="mono" style="font-size: 12px">{{ row.startPos.lat.toFixed(5) }}, {{ row.startPos.lng.toFixed(5) }}</span>
            <span v-else class="orange">No GPS</span>
            <div v-if="row.kind === 'pickup' && row.distance != null" class="muted" style="font-size: 12px" :class="{ red: row.distance > 200 }">{{ fmtM(row.distance) }} from device</div>
          </template>
        </el-table-column>
        <el-table-column label="Gap from prev." width="95"><template #default="{ $index }">{{ legIn($index) ? fmtDur(legIn($index).gap) : '—' }}</template></el-table-column>
        <el-table-column label="Straight line" width="95"><template #default="{ $index }">{{ legIn($index) ? fmtM(legIn($index).straight) : '—' }}</template></el-table-column>
        <el-table-column label="Expected drive" width="150">
          <template #default="{ $index }">
            <template v-if="legIn($index)?.route">{{ fmtDur(legIn($index).drive) }} · {{ fmtM(legIn($index).route.distanceM) }}</template>
            <span v-else-if="legIn($index)?.drive != null" class="muted">~{{ fmtDur(legIn($index).drive) }} (est.)</span>
            <span v-else-if="legIn($index)" class="muted">no GPS</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="Over expected" width="150">
          <template #default="{ $index }">
            <template v-if="legIn($index)?.over != null">
              <span :class="{ red: legIn($index).slow }">+{{ fmtDur(Math.max(0, legIn($index).over)) }}</span>
              <el-tooltip v-if="legIn($index).slow" placement="top" :content="`Step ${$index} → ${$index + 1}: gap ${fmtDur(legIn($index).gap)}, expected drive ${fmtDur(legIn($index).drive)}, over by ${fmtDur(legIn($index).over)}. Flagged because the extra time is over ${SLOW_MIN_MIN} min and more than the expected drive itself.`">
                <el-tag size="small" type="danger" style="margin-left: 4px; cursor: help">Slow leg</el-tag>
              </el-tooltip>
            </template>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="muted" style="font-size: 12px; margin-top: 8px">
        Each row shows the leg from the previous step to this one. Gap = this step start − previous step end. Expected drive = OSRM road time when routes are planned, otherwise straight line × {{ ROAD_FACTOR }} at {{ EST_SPEED_KMH }} km/h.
        Slow leg = gap exceeds expected drive by more than {{ SLOW_MIN_MIN }} min and by more than the expected drive itself.
        Day totals: gaps {{ fmtDur(day.totalGap) }} · straight line {{ fmtM(day.totalStraight) }}<template v-if="routed"> · road {{ fmtDur(day.totalDrive) }} / {{ fmtM(day.totalDriveM) }}</template> · slow legs {{ day.slow }} · steps without GPS {{ day.noGps }}
      </div>
    </div>
  </div>
  <el-empty v-else description="Driver not found" />
</template>
<script setup>
import { ref, computed, reactive, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import Pager from '../components/Pager.vue'
import { state, idx, nameOf, plateOf, fmtDate, fmtM, distanceM, DRIVER_STATUS } from '../store/db'
import { routeSteps } from '../store/routing'

const TAG = { pending: 'warning', active: 'success', inactive: 'info' }
const KIND_LABEL = { pickup: 'Pump-out', transfer: 'Transfer', unload: 'Unload' }
const KIND_TAG = { pickup: 'success', transfer: 'primary', unload: 'warning' }
const KIND_COLOR = { pickup: '#67c23a', transfer: '#409eff', unload: '#9b59b6' }
const FLAGS = { nogps: 'No GPS', location: 'Location mismatch', capacity: 'Over capacity' }
const ROAD_FACTOR = 1.3, EST_SPEED_KMH = 40, SLOW_MIN_MIN = 60
const route = useRoute(), router = useRouter()
const drv = computed(() => idx.drivers.value.get(route.params.id))
const initials = computed(() => (drv.value?.name || '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())

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
    const raw = p.flags || []
    const flags = [...(!startPos || raw.includes('nolocation') ? ['nogps'] : []), ...raw.filter((f) => f !== 'nolocation')]
    out.push({ kind: 'pickup', id: p.id, deviceId: p.deviceId, start: ms(p.startAt), end: ms(p.endAt), startPos, endPos, distance: p.distance, flags,
      label: `${idx.devices.value.get(p.deviceId)?.aka || ''} · ${nameOf('locations', p.locationId)} · ${p.volume != null ? p.volume.toLocaleString() + ' L' : 'in progress'} · ${plateOf(p.vehicleId)}` })
  }
  for (const t of state.transfers) {
    if (t.driverId !== id || !t.at) continue
    const at = ms(t.at), p = pos(t.lat, t.lng)
    out.push({ kind: 'transfer', id: t.id, start: at, end: at, startPos: p, endPos: p, flags: p ? [] : ['nogps'], label: `${(t.volume || 0).toLocaleString()} L from ${plateOf(t.fromVehicleId)} to ${plateOf(t.toVehicleId)}` })
  }
  for (const u of state.unloads) {
    if (u.driverId !== id || !u.at) continue
    const at = ms(u.at), p = pos(u.lat, u.lng)
    out.push({ kind: 'unload', id: u.id, start: at, end: at, startPos: p, endPos: p, flags: p ? [] : ['nogps'], label: `${(u.volume || 0).toLocaleString()} L at ${nameOf('facilities', u.facilityId)} · ${plateOf(u.vehicleId)}` })
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
    let totalGap = 0, totalStraight = 0, totalDrive = 0, totalDriveM = 0, slow = 0
    for (let i = 0; i < dsteps.length - 1; i++) {
      const a = dsteps[i], b = dsteps[i + 1]
      const gap = a.end != null ? b.start - a.end : null
      const straight = distanceM(a.endPos?.lat, a.endPos?.lng, b.startPos?.lat, b.startPos?.lng)
      const r = routes[a.id]
      const drive = r ? r.durationS * 1000 : straight != null ? (straight * ROAD_FACTOR) / (EST_SPEED_KMH / 3.6) * 1000 : null
      const over = gap != null && drive != null ? gap - drive : null
      const isSlow = over != null && over > Math.max(SLOW_MIN_MIN * 60e3, drive)
      a.next = { gap, straight, route: r, drive, over, slow: isSlow }
      if (isSlow) slow++
      if (gap != null) totalGap += gap
      if (straight != null) totalStraight += straight
      if (r) { totalDrive += r.durationS * 1000; totalDriveM += r.distanceM }
    }
    const ends = dsteps.map((s) => s.end).filter((v) => v != null)
    const first = dsteps[0].start, last = ends.length ? Math.max(...ends) : null
    return {
      key, label: new Date(first).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), steps: dsteps,
      jobs: dsteps.filter((s) => s.kind === 'pickup' && s.end).length, transfers: dsteps.filter((s) => s.kind === 'transfer').length,
      unloads: dsteps.filter((s) => s.kind === 'unload').length, first, last, span: last != null ? last - first : null,
      totalGap, totalStraight, totalDrive, totalDriveM, slow,
      noGps: dsteps.filter((s) => s.flags.includes('nogps')).length,
      other: dsteps.filter((s) => s.flags.some((f) => f !== 'nogps')).length
    }
  }).sort((a, b) => b.key.localeCompare(a.key))
})

const dayKey = ref('')
watch(days, (list) => { if (!list.some((d) => d.key === dayKey.value)) dayKey.value = list[0]?.key || '' }, { immediate: true })
const day = computed(() => days.value.find((d) => d.key === dayKey.value))
const legIn = (i) => day.value?.steps[i - 1]?.next ?? null
const page = ref(1), pageSize = ref(20)
const range = ref(null)
const filteredDays = computed(() => (range.value ? days.value.filter((d) => d.key >= range.value[0] && d.key <= range.value[1]) : days.value))
watch(range, () => {
  page.value = 1
  if (filteredDays.value.length && !filteredDays.value.some((d) => d.key === dayKey.value)) dayKey.value = filteredDays.value[0].key
})
const pagedDays = computed(() => filteredDays.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const dayCard = ref(null)
async function openDay(d) {
  dayKey.value = d.key
  await nextTick()
  dayCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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
    const label = `Step ${i + 1} → ${i + 2}`
    if (r) out.push({ path: r.geometry, label, road: true })
    else if (a.endPos && b.startPos) out.push({ path: [[a.endPos.lat, a.endPos.lng], [b.startPos.lat, b.startPos.lng]], label })
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
    noGps: all.filter((s) => s.flags.includes('nogps')).length, slow: days.value.reduce((n, d) => n + d.slow, 0),
    flagLocation: flag('location'), flagCapacity: flag('capacity'),
    transfers: all.filter((s) => s.kind === 'transfer').length, unloads: all.filter((s) => s.kind === 'unload').length
  }
})
const summaryTiles = computed(() => {
  const s = stats.value
  return [
    { label: 'Days worked', value: days.value.length },
    { label: 'Pump-outs completed', value: s.jobs },
    { label: 'Pump-outs per day', value: s.jobsPerDay },
    { label: 'Avg pump-out duration', value: fmtDur(s.avgJob) },
    { label: 'Avg gap between steps', value: fmtDur(s.avgGap) },
    { label: 'Avg distance between steps', value: fmtM(s.avgHop), hint: 'Straight-line distance' },
    { label: 'Steps without GPS', value: s.noGps, tone: s.noGps ? 'warn' : '' },
    { label: 'Slow legs', value: s.slow, tone: s.slow ? 'bad' : '', hint: 'Gap far above expected drive' },
    { label: 'Location mismatch / over cap.', value: `${s.flagLocation} / ${s.flagCapacity}`, tone: s.flagLocation + s.flagCapacity ? 'bad' : '' },
    { label: 'Transfers / unloads', value: `${s.transfers} / ${s.unloads}` }
  ]
})
</script>

<style scoped>
.days-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.days-table :deep(.el-table__row) { cursor: pointer; }
.days-table :deep(.current-day > td.el-table__cell) { background: var(--el-color-primary-light-8) !important; font-weight: 600; }
.orange { color: var(--el-color-warning); }
.stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.top-row { display: grid; grid-template-columns: 1fr 2.4fr; gap: 12px; margin-bottom: 12px; }
.work-row { display: grid; grid-template-columns: 7fr 5fr; gap: 12px; margin-bottom: 12px; align-items: start; }
.top-row > .card, .work-row > .card { margin-top: 0; }
.pf-head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
.pf-head b { display: block; font-size: 16px; color: #0f172a; }
.pf-head .link { font-size: 13px; }
.pf-avatar { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; flex: none; background: #e0f2fe; color: #0369a1; font-weight: 700; }
.pf-list { margin: 4px 0 0; }
.pf-list > div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f8fafc; font-size: 13px; }
.pf-list dt { color: #64748b; }
.pf-list dd { margin: 0; color: #0f172a; }
.flags { display: flex; flex-wrap: wrap; gap: 4px; }
.sub { font-size: 11px; }
.stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid #eef2f6; border-radius: 8px; background: #f8fafc; }
.stat small { font-size: 12px; color: #64748b; }
.stat b { font-size: 18px; font-weight: 600; color: #0f172a; }
.stat.warn { background: #fffbeb; border-color: #fde68a; }
.stat.warn b { color: #b45309; }
.stat.bad { background: #fff1f2; border-color: #fecdd3; }
.stat.bad b { color: #be123c; }
</style>
