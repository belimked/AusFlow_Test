<template>
  <div class="page">
    <el-row :gutter="12">
      <el-col v-for="s in stats" :key="s.label" :span="6">
        <div class="card kpi" @click="s.to && router.push(s.to)">
          <div class="icon" :style="{ background: s.color + '1a', color: s.color }"><el-icon :size="22"><component :is="s.icon" /></el-icon></div>
          <div>
            <div class="muted label">{{ s.label }}</div>
            <div class="num" :style="{ color: s.numColor }">{{ s.value }}</div>
            <div class="sub">{{ s.sub }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="12" class="row">
      <el-col :span="12"><div class="card"><div class="card-head"><h3>Pump-outs per month</h3></div><Chart :option="monthlyPumpOption" :height="300" /></div></el-col>
      <el-col :span="12"><div class="card"><div class="card-head"><h3>Collection status per month</h3></div><Chart :option="monthlyStatusOption" :height="300" @click="(e) => ['Delivered', 'Awaiting delivery'].includes(e.seriesName) && router.push('/pickups')" /></div></el-col>
    </el-row>

    <el-row :gutter="12" class="row">
      <el-col :span="16">
        <div class="card">
          <div class="card-head"><h3>Pump-outs · last 14 days</h3><span class="muted">bars = jobs per hauler · line = volume (L)</span></div>
          <Chart :option="trendOption" :height="300" />
        </div>
      </el-col>
      <el-col :span="8">
        <div class="card">
          <div class="card-head"><h3>Device compliance</h3><span class="muted">click a slice to filter</span></div>
          <Chart :option="complianceOption" :height="300" @click="onCompliance" />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="12" class="row">
      <el-col :span="12">
        <div class="card alerts-card">
          <div class="card-head">
            <h3>Alerts</h3>
            <div class="sev">
              <el-tag v-for="(l, k) in SEVERITY" :key="k" :type="SEV_TAG[k]" effect="dark" size="small" round>{{ l }} {{ sevCount[k] || 0 }}</el-tag>
            </div>
            <el-button link type="primary" style="margin-left: auto" @click="router.push('/alerts')">View all →</el-button>
          </div>
          <div class="chips">
            <el-check-tag :checked="!alertType" @change="alertType = ''">All {{ activeAlerts.length }}</el-check-tag>
            <template v-for="(l, t) in ALERT_TYPES" :key="t">
              <el-check-tag v-if="typeCount[t]" :checked="alertType === t" @change="alertType = alertType === t ? '' : t">{{ l }} {{ typeCount[t] }}</el-check-tag>
            </template>
          </div>
          <div class="scroll"><AlertList :items="shownAlerts" /></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card">
          <div class="card-head"><h3>Overdue devices by hauler</h3><span class="muted">split by how long overdue</span></div>
          <Chart :option="overdueOption" :height="200" @click="(e) => router.push({ path: '/devices', query: { overdue: '1', company: e.data?.companyId || 'none' } })" />
        </div>
        <el-row :gutter="12" class="row">
          <el-col :span="12">
            <div class="card">
              <div class="card-head"><h3>Volume by hauler</h3><span class="muted">14 days</span></div>
              <Chart :option="haulerOption" :height="220" />
            </div>
          </el-col>
          <el-col :span="12">
            <div class="card">
              <div class="card-head"><h3>Unloaded by facility</h3><span class="muted">14 days</span></div>
              <Chart :option="facilityOption" :height="220" />
            </div>
          </el-col>
        </el-row>
      </el-col>
    </el-row>

    <el-row :gutter="12" class="row">
      <el-col :span="10">
        <div class="card">
          <div class="card-head"><h3>Pump-out flags</h3><span class="muted">14 days</span></div>
          <Chart :option="flagOption" :height="220" @click="(e) => router.push({ path: '/pickups', query: { flag: e.data?.flag } })" />
        </div>
      </el-col>
      <el-col :span="14">
        <div class="card">
          <div class="card-head"><h3>Recent pump-outs</h3><el-button link type="primary" style="margin-left: auto" @click="router.push('/pickups')">View all →</el-button></div>
          <el-table :data="recent" size="small" @row-click="(r) => router.push('/pickups/' + r.id)" style="cursor: pointer">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column label="Device" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ row.deviceId }} · {{ nameOf('locations', row.locationId) }}</template></el-table-column>
            <el-table-column label="Volume" width="90" align="right"><template #default="{ row }">{{ fmtL(row.volume) }}</template></el-table-column>
            <el-table-column label="Status" width="150"><template #default="{ row }">
              <el-tag v-if="row.status === 'ongoing'" size="small" type="warning">In progress</el-tag>
              <el-tag v-else-if="row.flags.length" size="small" type="danger">{{ FLAG_LABEL[row.flags[0]] }}</el-tag>
              <el-tag v-else size="small" type="success">OK</el-tag>
            </template></el-table-column>
            <el-table-column label="Time" width="130"><template #default="{ row }">{{ fmtTime(row.endAt || row.startAt) }}</template></el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Chart from '../components/Chart.vue'
import AlertList from '../components/AlertList.vue'
import { state, haulers, nameOf, isOverdue, overdueDays, nextService, fmtTime, fmtL, traceForward } from '../store/db'
import { activeAlerts, ALERT_TYPES, SEVERITY } from '../store/alerts'

const router = useRouter()
const DAY = 864e5
const PALETTE = ['#2f6fd6', '#18a58a', '#f0a020', '#8e5bd8', '#e2574c', '#3fb1e3', '#9aa5b1']
const SEV_TAG = { critical: 'danger', warning: 'warning', info: 'info' }
const FLAG_LABEL = { location: 'Location mismatch', capacity: 'Over capacity', nolocation: 'No location' }
const tooltip = { trigger: 'item', confine: true }
const shortName = (n) => n.replace(/ (Waste Management|Environmental Services|Australia Pty Ltd|Pty Ltd|Ltd).*$/, '').replace("Lee's Environmental", "Lee's Env.")

const day0 = new Date(); day0.setHours(0, 0, 0, 0)
const days = Array.from({ length: 14 }, (_, i) => new Date(day0.getTime() - (13 - i) * DAY))
const dayLabel = (d) => `${d.getDate()}/${d.getMonth() + 1}`
const inLast = (s, n) => s && Date.now() - new Date(s).getTime() <= n * DAY
const monthStarts = Array.from({ length: 12 }, (_, i) => new Date(day0.getFullYear(), day0.getMonth() - 11 + i, 1))
const monthKey = (s) => { const d = new Date(s); return `${d.getFullYear()}-${d.getMonth()}` }
const monthIndex = new Map(monthStarts.map((d, i) => [monthKey(d), i]))
const monthLabels = monthStarts.map((d) => d.toLocaleString('en-AU', { month: 'short', year: 'numeric' }))
const monthly = computed(() => {
  const jobs = Array(12).fill(0), volume = Array(12).fill(0)
  const delivered = Array(12).fill(0), awaiting = Array(12).fill(0), progress = Array(12).fill(0)
  for (const p of state.pickups) {
    const i = monthIndex.get(monthKey(p.status === 'done' ? p.endAt : p.startAt))
    if (i == null) continue
    if (p.status === 'ongoing') { progress[i]++; continue }
    if (p.status !== 'done') continue
    jobs[i]++; volume[i] += (p.volume || 0) / 1000
    if (traceForward(p).finished) delivered[i]++
    else awaiting[i]++
  }
  return { jobs, volume: volume.map((v) => +v.toFixed(1)), delivered, awaiting, progress }
})
const monthlyPumpOption = computed(() => ({
  tooltip: { trigger: 'axis', confine: true }, legend: { bottom: 0 }, grid: { left: 50, right: 55, bottom: 50 },
  xAxis: { type: 'category', data: monthLabels }, yAxis: [{ type: 'value', name: 'Jobs', minInterval: 1 }, { type: 'value', name: 'kL', splitLine: { show: false } }],
  series: [{ name: 'Pump-outs', type: 'bar', data: monthly.value.jobs, itemStyle: { color: '#2f6fd6' } },
    { name: 'Volume (kL)', type: 'line', yAxisIndex: 1, data: monthly.value.volume, itemStyle: { color: '#18a58a' } }]
}))
const monthlyStatusOption = computed(() => ({
  tooltip: { trigger: 'axis', confine: true }, legend: { bottom: 0 }, grid: { left: 50, right: 20, bottom: 50 },
  xAxis: { type: 'category', data: monthLabels }, yAxis: { type: 'value', minInterval: 1 },
  series: [['Delivered', monthly.value.delivered, '#18a58a'], ['Awaiting delivery', monthly.value.awaiting, '#f0a020'], ['In progress', monthly.value.progress, '#2f6fd6']]
    .map(([name, data, color]) => ({ name, type: 'bar', stack: 'collection', data, itemStyle: { color } }))
}))
const done14 = computed(() => state.pickups.filter((p) => p.status === 'done' && inLast(p.endAt, 14)))

// ---------- KPIs ----------
const sumVol = (arr) => arr.reduce((s, p) => s + (p.volume || 0), 0)
const stats = computed(() => {
  const active = state.devices.filter((d) => d.status === 'Active')
  const overdue = active.filter(isOverdue)
  const p7 = state.pickups.filter((p) => p.status === 'done' && inLast(p.endAt, 7))
  const p7prev = state.pickups.filter((p) => p.status === 'done' && inLast(p.endAt, 14) && !inLast(p.endAt, 7))
  const delta = p7prev.length ? Math.round(((p7.length - p7prev.length) / p7prev.length) * 100) : 0
  const unl7 = state.unloads.filter((u) => inLast(u.at, 7))
  const crit = activeAlerts.value.filter((a) => a.severity === 'critical').length
  return [
    { label: 'Active devices', value: active.length.toLocaleString(), sub: `${state.locations.length} locations`, icon: 'Box', color: '#2f6fd6', to: { path: '/devices', query: { status: 'Active' } } },
    { label: 'Inactive devices', value: state.devices.filter((d) => d.status === 'Inactive').length, sub: 'not in service', icon: 'CircleClose', color: '#8a94a6', to: { path: '/devices', query: { status: 'Inactive' } } },
    { label: 'No frequency', value: active.filter((d) => !Number(d.freqWeeks)).length, sub: 'active without schedule', icon: 'Calendar', color: '#f0a020', to: { path: '/devices', query: { status: 'Active', freq: 'none' } } },
    { label: 'Overdue devices', value: overdue.length, sub: `${((overdue.length / (active.length || 1)) * 100).toFixed(1)}% of active`, icon: 'AlarmClock', color: '#e2574c', numColor: '#d93025', to: { path: '/devices', query: { overdue: '1' } } },
    { label: 'Pump-outs (7 days)', value: p7.length, sub: `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs prior week`, icon: 'Odometer', color: '#18a58a', to: '/pickups' },
    { label: 'Volume (7 days)', value: Math.round(sumVol(p7) / 1000) + ' kL', sub: `${unl7.length} unloads`, icon: 'Histogram', color: '#3fb1e3', to: '/unloads' },
    { label: 'Open alerts', value: activeAlerts.value.length, sub: `${crit} critical`, icon: 'Bell', color: '#f0a020', numColor: crit ? '#d93025' : undefined, to: '/alerts' },
    { label: 'Pending drivers', value: state.drivers.filter((d) => d.status === 'pending').length, sub: `${state.drivers.filter((d) => d.status === 'active').length} active drivers`, icon: 'User', color: '#8e5bd8', to: { path: '/drivers', query: { status: 'pending' } } }
  ]
})

// ---------- 14-day trend ----------
const trendOption = computed(() => {
  const idxOf = (s) => Math.floor((new Date(s).getTime() - days[0].getTime()) / DAY)
  const companies = haulers.value.filter((c) => done14.value.some((p) => p.companyId === c.id))
  const vol = Array(14).fill(0)
  const series = companies.map((c, i) => {
    const data = Array(14).fill(0)
    for (const p of done14.value) {
      const k = idxOf(p.endAt)
      if (k < 0 || k > 13) continue
      if (p.companyId === c.id) data[k]++
      if (i === 0) vol[k] += p.volume
    }
    return { name: shortName(c.name), type: 'bar', stack: 'jobs', barMaxWidth: 26, data, itemStyle: { color: PALETTE[i % PALETTE.length] } }
  })
  return {
    tooltip: { trigger: 'axis', confine: true },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 56, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: days.map(dayLabel), axisTick: { show: false } },
    yAxis: [
      { type: 'value', name: 'Jobs', minInterval: 1, splitLine: { lineStyle: { type: 'dashed' } } },
      { type: 'value', name: 'Litres', splitLine: { show: false }, axisLabel: { formatter: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } }
    ],
    series: [
      ...series,
      { name: 'Volume (L)', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6, data: vol, itemStyle: { color: '#1f2d3d' }, lineStyle: { width: 2 }, areaStyle: { color: 'rgba(31,45,61,.06)' } }
    ]
  }
})

// ---------- compliance pie ----------
const compliance = computed(() => {
  const now = Date.now()
  const c = { overdue: 0, due14: 0, ok: 0, nosched: 0, inactive: 0, removed: 0 }
  for (const d of state.devices) {
    if (d.status === 'Removed') c.removed++
    else if (d.status !== 'Active') c.inactive++
    else if (!nextService(d)) c.nosched++
    else if (isOverdue(d)) c.overdue++
    else if (new Date(nextService(d)).getTime() - now <= 14 * DAY) c.due14++
    else c.ok++
  }
  return c
})
const COMPLIANCE = [
  ['ok', 'On schedule', '#18a58a'], ['due14', 'Due within 14 days', '#f0a020'], ['overdue', 'Overdue', '#e2574c'],
  ['nosched', 'No schedule', '#b8c2cc'], ['inactive', 'Inactive', '#8a94a6'], ['removed', 'Removed', '#5b6573']
]
const complianceOption = computed(() => {
  const total = state.devices.length
  return {
    tooltip: { ...tooltip, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    title: { text: total.toLocaleString(), subtext: 'devices', left: 'center', top: '34%', textStyle: { fontSize: 22 }, subtextStyle: { fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['48%', '70%'], center: ['50%', '42%'], avoidLabelOverlap: true, label: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: COMPLIANCE.map(([key, name, color]) => ({ key, name, value: compliance.value[key], itemStyle: { color } })).filter((d) => d.value)
    }]
  }
})
function onCompliance(e) {
  const k = e.data?.key
  if (k === 'overdue') router.push({ path: '/devices', query: { overdue: '1' } })
  else if (k === 'inactive') router.push({ path: '/devices', query: { status: 'Inactive' } })
  else if (k === 'removed') router.push({ path: '/devices', query: { status: 'Removed' } })
  else router.push({ path: '/devices', query: { status: 'Active' } })
}

// ---------- overdue by hauler ----------
const overdueOption = computed(() => {
  const groups = new Map()
  for (const d of state.devices) {
    if (!isOverdue(d)) continue
    const key = d.companyId || 'none'
    const g = groups.get(key) || { lt4: 0, lt12: 0, ge12: 0 }
    const w = overdueDays(d) / 7
    if (w < 4) g.lt4++; else if (w < 12) g.lt12++; else g.ge12++
    groups.set(key, g)
  }
  const keys = [...groups.keys()]
  const label = (k) => (k === 'none' ? 'No hauler' : shortName(nameOf('companies', k)))
  const ser = (field, name, color) => ({
    name, type: 'bar', stack: 'od', barMaxWidth: 18, itemStyle: { color },
    data: keys.map((k) => ({ value: groups.get(k)[field], companyId: k === 'none' ? null : k }))
  })
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { left: 110, right: 20, top: 28, bottom: 20 },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { type: 'dashed' } } },
    yAxis: { type: 'category', data: keys.map(label), axisTick: { show: false } },
    series: [ser('lt4', '< 4 weeks', '#f0a020'), ser('lt12', '4–12 weeks', '#e2574c'), ser('ge12', '12+ weeks', '#9b1c1c')]
  }
})

// ---------- hauler / facility ----------
const haulerOption = computed(() => {
  const m = new Map()
  for (const p of done14.value) m.set(p.companyId, (m.get(p.companyId) || 0) + p.volume)
  return {
    tooltip: { ...tooltip, valueFormatter: (v) => fmtL(v) },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['42%', '70%'], center: ['50%', '40%'], label: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: [...m].sort((a, b) => b[1] - a[1]).map(([id, v], i) => ({ name: shortName(nameOf('companies', id)), value: v, itemStyle: { color: PALETTE[i % PALETTE.length] } }))
    }]
  }
})
const facilityOption = computed(() => {
  const m = new Map()
  for (const u of state.unloads) if (inLast(u.at, 14)) m.set(u.facilityId, (m.get(u.facilityId) || 0) + u.volume)
  const rows = [...m].sort((a, b) => a[1] - b[1])
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => fmtL(v), confine: true },
    grid: { left: 8, right: 58, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { type: 'dashed' } } },
    yAxis: { type: 'category', data: rows.map(([id]) => nameOf('facilities', id).replace(/ (Liquid Waste|Grease Processing|Treatment Works|Liquid Waste Treatment).*/, '')), axisTick: { show: false } },
    series: [{ type: 'bar', barMaxWidth: 16, data: rows.map(([, v]) => v), itemStyle: { color: '#18a58a', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', fontSize: 10, formatter: ({ value }) => (value / 1000).toFixed(1) + ' kL' } }]
  }
})

// ---------- flags ----------
const flagOption = computed(() => {
  const c = { ok: 0, location: 0, capacity: 0, nolocation: 0 }
  for (const p of done14.value) {
    if (!p.flags.length) c.ok++
    for (const f of p.flags) c[f]++
  }
  return {
    tooltip: { ...tooltip, formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'middle', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['45%', '72%'], center: ['35%', '50%'], label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: [
        { name: 'No issues', value: c.ok, itemStyle: { color: '#18a58a' } },
        { name: 'Location mismatch', value: c.location, flag: 'location', itemStyle: { color: '#e2574c' } },
        { name: 'Over capacity', value: c.capacity, flag: 'capacity', itemStyle: { color: '#f0a020' } },
        { name: 'No location', value: c.nolocation, flag: 'nolocation', itemStyle: { color: '#8a94a6' } }
      ]
    }]
  }
})

// ---------- alerts / recent ----------
const alertType = ref('')
const typeCount = computed(() => activeAlerts.value.reduce((m, a) => ((m[a.type] = (m[a.type] || 0) + 1), m), {}))
const sevCount = computed(() => activeAlerts.value.reduce((m, a) => ((m[a.severity] = (m[a.severity] || 0) + 1), m), {}))
const shownAlerts = computed(() => activeAlerts.value.filter((a) => !alertType.value || a.type === alertType.value).slice(0, 40))
const recent = computed(() => [...state.pickups].sort((a, b) => (b.endAt || b.startAt).localeCompare(a.endAt || a.startAt)).slice(0, 7))
</script>
<style scoped>
.row { margin-top: 12px; }
.kpi { display: flex; gap: 12px; align-items: center; cursor: pointer; transition: box-shadow .15s; height: 100%; box-sizing: border-box; }
.kpi { margin-bottom: 12px; min-height: 96px; }
.kpi:hover { box-shadow: 0 4px 14px rgba(0,0,0,.08); }
.kpi .icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.kpi .label { font-size: 12px; white-space: nowrap; }
.kpi .num { white-space: nowrap; font-size: 24px; font-weight: 700; line-height: 1.25; }
.kpi .sub { font-size: 11px; color: #a0a8b5; white-space: nowrap; }
.card-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.card-head h3 { margin: 0; font-size: 15px; }
.card-head .muted { font-size: 12px; }
.sev { display: flex; gap: 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.chips .el-check-tag { font-size: 12px; padding: 4px 10px; }
.alerts-card { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
.scroll { flex: 1; overflow-y: auto; max-height: 470px; border: 1px solid #f0f2f5; border-radius: 6px; }
:deep(.el-radio-group) { display: flex; }
</style>
