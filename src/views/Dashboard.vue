<template>
  <div class="page dash">
    <section class="welcome">
      <div class="w-text">
        <div class="w-eyebrow"><span class="w-chip">OPERATIONS OVERVIEW</span><span>{{ BRAND.console }} • {{ todayLabel }}</span></div>
        <h2>Welcome back, {{ displayName }}</h2>
        <p>
          {{ kpi.active.length }} active devices across {{ state.locations.length }} locations.
          {{ kpi.overdue.length }} overdue for service and {{ kpi.crit }} critical alerts need attention; {{ kpi.p7.length }} pump-outs completed in the last 7 days.
        </p>
      </div>
      <div class="w-actions">
        <button class="w-btn glass" @click="router.push('/alerts')"><el-icon><Bell /></el-icon>Review alerts</button>
        <button class="w-btn solid" @click="router.push({ path: '/devices', query: { overdue: '1' } })"><el-icon><AlarmClock /></el-icon>Overdue devices</button>
      </div>
    </section>

    <div class="kpis">
      <div v-for="k in kpis" :key="k.label" class="card kpi" @click="router.push(k.to)">
        <div class="k-head"><span>{{ k.label }}</span><el-icon :size="20" :style="{ color: k.color }"><component :is="k.icon" /></el-icon></div>
        <div class="k-main">
          <b class="mono">{{ k.value }}</b><small>{{ k.unit }}</small>
          <span class="badge" :class="k.tone"><i />{{ k.chip }}</span>
        </div>
        <div class="k-note">{{ k.note }}</div>
        <div class="k-foot"><span>{{ k.footLabel }}</span><b class="mono">{{ k.footValue }}</b></div>
        <div class="segbar"><i v-for="(s, i) in k.segments" :key="i" :style="{ flex: s.value, background: s.color }" /></div>
      </div>
    </div>

    <div class="grid g-16-8">
      <div class="card">
        <div class="c-head">
          <el-icon class="c-icon"><Histogram /></el-icon>
          <div><h3>{{ TREND_VIEWS[trendView].title }}</h3><p>{{ TREND_VIEWS[trendView].sub }}</p></div>
          <el-radio-group v-model="trendView" size="small" class="push">
            <el-radio-button v-for="(v, k) in TREND_VIEWS" :key="k" :value="k">{{ v.label }}</el-radio-button>
          </el-radio-group>
        </div>
        <Chart :option="trendOptions[trendView]" :height="300" @click="onTrendClick" />
      </div>
      <div class="card">
        <div class="c-head">
          <el-icon class="c-icon"><PieChart /></el-icon>
          <div><h3>Device compliance</h3><p>Service schedule status across all devices</p></div>
        </div>
        <div class="donut-wrap">
          <Chart :option="complianceOption" :height="200" @click="(e) => onCompliance(e.data?.key)" />
          <ul class="legend">
            <li v-for="c in complianceRows" :key="c.key" @click="onCompliance(c.key)">
              <i :style="{ background: c.color }" /><span>{{ c.name }}</span><b class="mono">{{ c.value }}</b><small class="mono">{{ c.pct }}%</small>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="grid g-14-10">
      <div class="card">
        <div class="c-head">
          <el-icon class="c-icon"><Odometer /></el-icon>
          <div><h3>Service quality</h3><p>Completed pump-outs, last 14 days</p></div>
          <span class="badge green push"><i />{{ done14.length }} jobs measured</span>
        </div>
        <div class="gauges">
          <div v-for="g in gauges" :key="g.label" class="gauge" @click="router.push(g.to)">
            <div class="g-title">{{ g.label }}</div>
            <Chart :option="gaugeOption(g.value, g.tone)" :height="120" />
            <div class="g-cap">{{ g.caption }}</div>
            <span class="badge" :class="g.tone"><i />{{ g.status }}</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="c-head">
          <el-icon class="c-icon"><Trophy /></el-icon>
          <div><h3>Overdue devices by transport company</h3><p>Worst first · click to filter the device list</p></div>
          <el-button link type="primary" class="push" @click="router.push({ path: '/devices', query: { overdue: '1' } })">All overdue →</el-button>
        </div>
        <div v-if="!overdueRank.length" class="empty">No overdue devices.</div>
        <ol class="rank">
          <li v-for="(r, i) in overdueRank.slice(0, 5)" :key="r.key" @click="router.push({ path: '/devices', query: { overdue: '1', company: r.key } })">
            <div class="r-line">
              <span class="r-no mono" :class="{ top: i === 0 }">{{ i + 1 }}</span>
              <span class="r-name">{{ r.name }}</span>
              <b class="mono" :style="{ color: r.color }">{{ r.total }}</b>
              <small>{{ r.note }}</small>
            </div>
            <div class="r-bar"><i :style="{ width: (r.total / overdueRank[0].total) * 100 + '%', background: r.color }" /></div>
          </li>
        </ol>
        <div v-if="overdueRank.length" class="rank-foot">
          <div v-for="b in overdueBuckets" :key="b.label"><b class="mono" :style="{ color: b.color }">{{ b.value }}</b><span>{{ b.label }}</span></div>
        </div>
      </div>
    </div>

    <div class="grid g-14-10">
      <div class="card alerts-card">
        <div class="c-head">
          <el-icon class="c-icon"><Bell /></el-icon>
          <div><h3>Alerts</h3><p>{{ activeAlerts.length }} open · {{ unreadTotal }} unread</p></div>
          <label class="switch-label push">Unread only <el-switch v-model="unreadOnly" /></label>
          <el-button link type="primary" @click="router.push('/alerts')">View all →</el-button>
        </div>
        <div class="alert-tools">
          <el-radio-group v-model="alertSeverity" size="small">
            <el-radio-button value="">All {{ byType.length }}</el-radio-button>
            <el-radio-button v-for="(l, k) in SEVERITY" :key="k" :value="k">{{ l }} {{ sevCount[k] || 0 }}</el-radio-button>
          </el-radio-group>
        </div>
        <div class="chips">
          <el-check-tag :checked="!alertType" @change="alertType = ''">All types</el-check-tag>
          <template v-for="(l, t) in ALERT_TYPES" :key="t">
            <el-check-tag v-if="typeCount[t]" :checked="alertType === t" @change="alertType = alertType === t ? '' : t">{{ l }} {{ typeCount[t] }}</el-check-tag>
          </template>
        </div>
        <div class="scroll"><AlertList :items="shownAlerts" /></div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="c-head">
            <el-icon class="c-icon"><Van /></el-icon>
            <div><h3>Volume by transport company</h3><p>Pump-outs, last 14 days</p></div>
          </div>
          <Chart :option="transportOption" :height="220" />
        </div>
        <div class="card">
          <div class="c-head">
            <el-icon class="c-icon"><School /></el-icon>
            <div><h3>Unloaded by facility</h3><p>Last 14 days</p></div>
          </div>
          <Chart :option="facilityOption" :height="220" />
        </div>
      </div>
    </div>

    <div class="card table-card">
      <div class="c-head">
        <el-icon class="c-icon"><Tickets /></el-icon>
        <div><h3>Recent pump-outs</h3><p>{{ state.pickups.length.toLocaleString() }} on record</p></div>
        <el-radio-group v-model="recentFilter" size="small" class="push">
          <el-radio-button value="">All</el-radio-button>
          <el-radio-button value="ongoing">In progress</el-radio-button>
          <el-radio-button value="flagged">Flagged</el-radio-button>
        </el-radio-group>
        <el-button @click="router.push('/pickups')">View all</el-button>
      </div>
      <el-table :data="recent" @row-click="(r) => router.push('/pickups/' + r.id)" style="cursor: pointer">
        <el-table-column label="Job" width="100"><template #default="{ row }"><span class="mono id">{{ row.id }}</span></template></el-table-column>
        <el-table-column label="Device · location" min-width="240" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ row.deviceId }}</span> <span class="muted">·</span> {{ nameOf('locations', row.locationId) }}</template>
        </el-table-column>
        <el-table-column label="Transport company" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ shortName(nameOf('companies', row.companyId)) }}</template></el-table-column>
        <el-table-column label="Driver" min-width="130" show-overflow-tooltip><template #default="{ row }">{{ nameOf('drivers', row.driverId) }}</template></el-table-column>
        <el-table-column label="Volume" width="110" align="right"><template #default="{ row }"><span class="mono">{{ row.volume ? row.volume.toLocaleString() : '—' }}</span> <small class="muted">L</small></template></el-table-column>
        <el-table-column label="Status" width="170">
          <template #default="{ row }">
            <span v-if="row.status === 'ongoing'" class="badge amber"><i />In progress</span>
            <span v-else-if="row.flags.length" class="badge rose"><i />{{ FLAG_LABEL[row.flags[0]] }}</span>
            <span v-else class="badge green"><i />OK</span>
          </template>
        </el-table-column>
        <el-table-column label="Time" width="170"><template #default="{ row }"><span class="mono nowrap">{{ fmtTime(row.endAt || row.startAt) }}</span></template></el-table-column>
      </el-table>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Chart from '../components/Chart.vue'
import AlertList from '../components/AlertList.vue'
import { state, transports, nameOf, isOverdue, overdueDays, nextService, fmtTime, fmtL, traceForward } from '../store/db'
import { activeAlerts, ALERT_TYPES, SEVERITY, isRead } from '../store/alerts'
import { currentUser } from '../store/api'
import { BRAND } from '../brand'

const router = useRouter()
const DAY = 864e5
const C = { blue: '#0284c7', cyan: '#06b6d4', deep: '#0369a1', indigo: '#2563eb', green: '#059669', amber: '#d97706', rose: '#e11d48', slate: '#94a3b8', ink: '#0f172a' }
const PALETTE = [C.blue, C.cyan, C.indigo, C.green, C.amber, '#7c3aed', C.slate]
const FLAG_LABEL = { location: 'Location mismatch', capacity: 'Over capacity', nolocation: 'No location' }
const FONT = "'Inter Variable', Inter, -apple-system, sans-serif"
const MONO = "'JetBrains Mono Variable', ui-monospace, monospace"
const shortName = (n) => n.replace(/ (Waste Management|Environmental Services|Australia Pty Ltd|Pty Ltd|Ltd).*$/, '').replace("Lee's Environmental", "Lee's Env.")
const grad = (a, b, h) => ({ type: 'linear', x: 0, y: 0, x2: h ? 1 : 0, y2: h ? 0 : 1, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }] })
const TIP = { confine: true, backgroundColor: '#fff', borderColor: '#cbd5e1', textStyle: { color: '#1e293b', fontFamily: FONT, fontSize: 12 }, extraCssText: 'box-shadow:0 4px 6px -1px rgba(15,23,42,.06),0 2px 4px -2px rgba(15,23,42,.04);border-radius:8px;' }
const AXIS = { axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false }, axisLabel: { color: '#64748b', fontFamily: FONT } }
const VAXIS = { axisLabel: { color: '#94a3b8', fontFamily: MONO, fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9' } }, nameTextStyle: { color: '#94a3b8', fontFamily: FONT } }
const LEGEND = { bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: '#475569', fontFamily: FONT, fontSize: 12 } }

const user = currentUser()
const displayName = (user?.name || user?.username || 'there').replace(/^./, (c) => c.toUpperCase())
const todayLabel = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

const day0 = new Date(); day0.setHours(0, 0, 0, 0)
const days = Array.from({ length: 14 }, (_, i) => new Date(day0.getTime() - (13 - i) * DAY))
const dayLabel = (d) => `${d.getDate()}/${d.getMonth() + 1}`
const inLast = (s, n) => s && Date.now() - new Date(s).getTime() <= n * DAY
const monthStarts = Array.from({ length: 12 }, (_, i) => new Date(day0.getFullYear(), day0.getMonth() - 11 + i, 1))
const monthKey = (s) => { const d = new Date(s); return `${d.getFullYear()}-${d.getMonth()}` }
const monthIndex = new Map(monthStarts.map((d, i) => [monthKey(d), i]))
const monthLabels = monthStarts.map((d) => d.toLocaleString('en-AU', { month: 'short' }))
const pct = (a, b) => (b ? +((a / b) * 100).toFixed(1) : 100)
const sumVol = (arr) => arr.reduce((s, p) => s + (p.volume || 0), 0)

const done14 = computed(() => state.pickups.filter((p) => p.status === 'done' && inLast(p.endAt, 14)))

// ---------- KPIs ----------
const kpi = computed(() => {
  const active = state.devices.filter((d) => d.status === 'Active')
  const overdue = active.filter(isOverdue)
  const p7 = state.pickups.filter((p) => p.status === 'done' && inLast(p.endAt, 7))
  const p7prev = state.pickups.filter((p) => p.status === 'done' && inLast(p.endAt, 14) && !inLast(p.endAt, 7))
  const crit = activeAlerts.value.filter((a) => a.severity === 'critical').length
  return { active, overdue, p7, p7prev, crit }
})
const unreadTotal = computed(() => activeAlerts.value.filter((a) => !isRead(a)).length)
const kpis = computed(() => {
  const { active, overdue, p7, p7prev, crit } = kpi.value
  const delta = p7prev.length ? Math.round(((p7.length - p7prev.length) / p7prev.length) * 100) : 0
  const delivered7 = p7.filter((p) => traceForward(p).finished).length
  const unl7 = state.unloads.filter((u) => inLast(u.at, 7)).length
  const c = compliance.value
  const sev = sevAll.value
  const pending = state.drivers.filter((d) => d.status === 'pending').length
  const activeDrivers = state.drivers.filter((d) => d.status === 'active').length
  const today = new Set(state.pickups.filter((p) => p.startAt && new Date(p.startAt) >= day0).map((p) => p.driverId)).size
  return [
    { label: 'Pump-outs · 7 days', icon: 'Odometer', color: C.blue, to: '/pickups',
      value: p7.length, unit: 'jobs', chip: `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs prior wk`, tone: delta >= 0 ? 'green' : 'rose',
      note: `${Math.round(sumVol(p7) / 1000).toLocaleString()} kL collected · ${unl7} unloads`,
      footLabel: 'Delivered to facility', footValue: `${pct(delivered7, p7.length)}%`,
      segments: [{ value: delivered7, color: C.blue }, { value: p7.length - delivered7, color: '#e2e8f0' }] },
    { label: 'Device compliance', icon: 'CircleCheck', color: C.green, to: { path: '/devices', query: { overdue: '1' } },
      value: pct(active.length - overdue.length, active.length), unit: '% on schedule', chip: overdue.length ? `${overdue.length} overdue` : 'All on schedule', tone: overdue.length ? 'rose' : 'green',
      note: `${active.length} active · ${c.inactive} inactive · ${c.nosched} no schedule`,
      footLabel: 'Due within 14 days', footValue: c.due14,
      segments: [{ value: c.ok, color: C.green }, { value: c.due14, color: '#f59e0b' }, { value: c.overdue, color: '#f43f5e' }, { value: c.nosched, color: '#cbd5e1' }] },
    { label: 'Open alerts', icon: 'Bell', color: C.amber, to: '/alerts',
      value: activeAlerts.value.length, unit: 'open', chip: crit ? `${crit} critical` : 'No critical', tone: crit ? 'rose' : 'green',
      note: `${unreadTotal.value} unread · ${Object.keys(typeCount.value).length} alert types`,
      footLabel: 'Critical / warning / info', footValue: `${sev.critical || 0} / ${sev.warning || 0} / ${sev.info || 0}`,
      segments: [{ value: sev.critical || 0, color: '#f43f5e' }, { value: sev.warning || 0, color: '#f59e0b' }, { value: sev.info || 0, color: '#cbd5e1' }] },
    { label: 'Drivers & fleet', icon: 'Van', color: '#7c3aed', to: { path: '/drivers', query: { status: 'pending' } },
      value: activeDrivers, unit: 'active drivers', chip: pending ? `${pending} pending approval` : 'None pending', tone: pending ? 'amber' : 'green',
      note: `${state.vehicles.length} vehicles · ${transports.value.length} transport companies`,
      footLabel: 'Drivers on the road today', footValue: today,
      segments: [{ value: activeDrivers, color: '#7c3aed' }, { value: pending, color: '#f59e0b' }] }
  ]
})

// ---------- trend card ----------
const TREND_VIEWS = {
  monthly: { label: '12 months', title: 'Pump-outs per month', sub: 'Completed jobs and collected volume' },
  status: { label: 'Collection status', title: 'Collection status per month', sub: 'Whether collected waste has reached a facility' },
  daily: { label: 'Last 14 days', title: 'Pump-outs · last 14 days', sub: 'Jobs per transport company, volume as a line' }
}
const trendView = ref('monthly')
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
const trendOptions = computed(() => {
  const m = monthly.value
  const idxOf = (s) => Math.floor((new Date(s).getTime() - days[0].getTime()) / DAY)
  const companies = transports.value.filter((c) => done14.value.some((p) => p.companyId === c.id))
  const vol = Array(14).fill(0)
  const daily = companies.map((c, i) => {
    const data = Array(14).fill(0)
    for (const p of done14.value) {
      const k = idxOf(p.endAt)
      if (k < 0 || k > 13) continue
      if (p.companyId === c.id) data[k]++
      if (i === 0) vol[k] += p.volume
    }
    return { name: shortName(c.name), type: 'bar', stack: 'jobs', barMaxWidth: 22, data, itemStyle: { color: PALETTE[i % PALETTE.length] } }
  })
  const base = { tooltip: { ...TIP, trigger: 'axis' }, legend: LEGEND, grid: { left: 44, right: 52, top: 30, bottom: 44 } }
  return {
    monthly: { ...base,
      xAxis: { type: 'category', data: monthLabels, ...AXIS },
      yAxis: [{ type: 'value', name: 'Jobs', minInterval: 1, ...VAXIS }, { type: 'value', name: 'kL', ...VAXIS, splitLine: { show: false } }],
      series: [
        { name: 'Pump-outs', type: 'bar', barMaxWidth: 30, data: m.jobs, itemStyle: { color: grad('#0ea5e9', '#0369a1'), borderRadius: [4, 4, 0, 0] } },
        { name: 'Volume (kL)', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 6, data: m.volume, itemStyle: { color: C.cyan }, lineStyle: { width: 2, type: 'dashed' } }
      ] },
    status: { ...base, grid: { ...base.grid, right: 20 },
      xAxis: { type: 'category', data: monthLabels, ...AXIS }, yAxis: { type: 'value', minInterval: 1, ...VAXIS },
      series: [['Delivered', m.delivered, C.green], ['Awaiting delivery', m.awaiting, '#f59e0b'], ['In progress', m.progress, C.blue]]
        .map(([name, data, color], i) => ({ name, type: 'bar', stack: 'collection', barMaxWidth: 30, data, itemStyle: { color, borderRadius: i === 2 ? [4, 4, 0, 0] : 0 } })) },
    daily: { ...base, legend: { ...LEGEND, type: 'scroll' },
      xAxis: { type: 'category', data: days.map(dayLabel), ...AXIS },
      yAxis: [{ type: 'value', name: 'Jobs', minInterval: 1, ...VAXIS }, { type: 'value', name: 'Litres', ...VAXIS, splitLine: { show: false }, axisLabel: { ...VAXIS.axisLabel, formatter: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } }],
      series: [...daily, { name: 'Volume (L)', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 5, data: vol, itemStyle: { color: C.ink }, lineStyle: { width: 2 }, areaStyle: { color: grad('rgba(2,132,199,.14)', 'rgba(255,255,255,0)') } }] }
  }
})
function onTrendClick(e) {
  if (trendView.value === 'status' && ['Delivered', 'Awaiting delivery'].includes(e.seriesName)) router.push('/pickups')
}

// ---------- compliance ----------
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
  ['ok', 'On schedule', C.green], ['due14', 'Due within 14 days', '#f59e0b'], ['overdue', 'Overdue', '#f43f5e'],
  ['nosched', 'No schedule', '#cbd5e1'], ['inactive', 'Inactive', '#94a3b8'], ['removed', 'Removed', '#475569']
]
const complianceRows = computed(() => COMPLIANCE.map(([key, name, color]) => ({ key, name, color, value: compliance.value[key], pct: pct(compliance.value[key], state.devices.length) })).filter((r) => r.value))
const complianceOption = computed(() => ({
  tooltip: { ...TIP, trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  title: { text: state.devices.length.toLocaleString(), subtext: 'devices', left: 'center', top: '36%', textStyle: { fontSize: 24, fontFamily: MONO, color: C.ink, fontWeight: 600 }, subtextStyle: { fontSize: 11, color: '#64748b', fontFamily: FONT } },
  series: [{ type: 'pie', radius: ['62%', '88%'], center: ['50%', '50%'], label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 3 },
    data: complianceRows.value.map((r) => ({ key: r.key, name: r.name, value: r.value, itemStyle: { color: r.color } })) }]
}))
function onCompliance(k) {
  if (k === 'overdue') router.push({ path: '/devices', query: { overdue: '1' } })
  else if (k === 'inactive') router.push({ path: '/devices', query: { status: 'Inactive' } })
  else if (k === 'removed') router.push({ path: '/devices', query: { status: 'Removed' } })
  else if (k === 'nosched') router.push({ path: '/devices', query: { status: 'Active', freq: 'none' } })
  else router.push({ path: '/devices', query: { status: 'Active' } })
}

// ---------- service quality gauges ----------
const gauges = computed(() => {
  const d = done14.value
  const tone = (v) => (v >= 95 ? 'green' : v >= 85 ? 'amber' : 'rose')
  const status = (v) => (v >= 95 ? 'Good' : v >= 85 ? 'Watch' : 'Action needed')
  const active = kpi.value.active
  const list = [
    { label: 'On schedule', value: pct(active.length - kpi.value.overdue.length, active.length), caption: 'active devices not overdue', to: { path: '/devices', query: { overdue: '1' } } },
    { label: 'Delivered', value: pct(d.filter((p) => traceForward(p).finished).length, d.length), caption: 'waste reached a facility', to: '/trace' },
    { label: 'Clean jobs', value: pct(d.filter((p) => !p.flags.length).length, d.length), caption: 'no location / capacity flag', to: '/pickups' },
    { label: 'GPS coverage', value: pct(d.filter((p) => !p.flags.includes('nolocation')).length, d.length), caption: 'pump-outs with a location', to: { path: '/pickups', query: { flag: 'nolocation' } } }
  ]
  return list.map((g) => ({ ...g, tone: tone(g.value), status: status(g.value) }))
})
const GAUGE_COLORS = { green: ['#06b6d4', '#0284c7'], amber: ['#fbbf24', '#d97706'], rose: ['#fb7185', '#e11d48'] }
function gaugeOption(v, tone) {
  const [a, b] = GAUGE_COLORS[tone]
  return { series: [{
    type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: 100, radius: '96%', center: ['50%', '60%'],
    progress: { show: true, width: 9, roundCap: true, itemStyle: { color: grad(a, b, true) } },
    axisLine: { roundCap: true, lineStyle: { width: 9, color: [[1, '#e2e8f0']] } },
    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false }, title: { show: false },
    detail: { offsetCenter: [0, '6%'], fontSize: 20, fontWeight: 600, fontFamily: MONO, color: C.ink, formatter: '{value}%' },
    data: [{ value: v }]
  }] }
}

// ---------- overdue ranking ----------
const overdueRank = computed(() => {
  const groups = new Map()
  for (const d of state.devices) {
    if (!isOverdue(d)) continue
    const key = d.companyId || 'none'
    const g = groups.get(key) || { lt4: 0, lt12: 0, ge12: 0 }
    const w = overdueDays(d) / 7
    if (w < 4) g.lt4++; else if (w < 12) g.lt12++; else g.ge12++
    groups.set(key, g)
  }
  return [...groups].map(([key, g]) => ({
    key, total: g.lt4 + g.lt12 + g.ge12,
    name: key === 'none' ? 'No transport company' : shortName(nameOf('companies', key)),
    color: g.ge12 ? '#be123c' : g.lt12 ? C.rose : C.amber,
    note: g.ge12 ? `${g.ge12} over 12 wk` : g.lt12 ? `${g.lt12} over 4 wk` : 'under 4 wk'
  })).sort((a, b) => b.total - a.total)
})
const overdueBuckets = computed(() => {
  const b = { lt4: 0, lt12: 0, ge12: 0 }
  for (const d of state.devices.filter(isOverdue)) { const w = overdueDays(d) / 7; if (w < 4) b.lt4++; else if (w < 12) b.lt12++; else b.ge12++ }
  return [{ label: 'under 4 weeks', value: b.lt4, color: C.amber }, { label: '4–12 weeks', value: b.lt12, color: C.rose }, { label: '12+ weeks', value: b.ge12, color: '#be123c' }]
})

// ---------- transport / facility ----------
const transportOption = computed(() => {
  const m = new Map()
  for (const p of done14.value) m.set(p.companyId, (m.get(p.companyId) || 0) + p.volume)
  return {
    tooltip: { ...TIP, trigger: 'item', valueFormatter: (v) => fmtL(v) },
    legend: { ...LEGEND, orient: 'vertical', bottom: 'auto', right: 0, top: 'middle', type: 'scroll', textStyle: { ...LEGEND.textStyle, fontSize: 11 } },
    series: [{ type: 'pie', radius: ['55%', '82%'], center: ['28%', '50%'], label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 3 },
      data: [...m].sort((a, b) => b[1] - a[1]).map(([id, v], i) => ({ name: shortName(nameOf('companies', id)), value: v, itemStyle: { color: PALETTE[i % PALETTE.length] } })) }]
  }
})
const facilityOption = computed(() => {
  const m = new Map()
  for (const u of state.unloads) if (inLast(u.at, 14)) m.set(u.facilityId, (m.get(u.facilityId) || 0) + u.volume)
  const rows = [...m].sort((a, b) => a[1] - b[1])
  return {
    tooltip: { ...TIP, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => fmtL(v) },
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'category', data: rows.map(([id]) => nameOf('facilities', id).replace(/ (Liquid Waste|Grease Processing|Treatment Works|Liquid Waste Treatment).*/, '')), ...AXIS, axisLine: { show: false } },
    series: [{ type: 'bar', barMaxWidth: 14, data: rows.map(([, v]) => v), showBackground: true, backgroundStyle: { color: '#f1f5f9', borderRadius: 7 },
      itemStyle: { color: grad(C.cyan, C.blue, true), borderRadius: 7 },
      label: { show: true, position: 'right', fontSize: 11, fontFamily: MONO, color: '#475569', formatter: ({ value }) => (value / 1000).toFixed(1) + ' kL' } }]
  }
})

// ---------- alerts ----------
const alertType = ref('')
const alertSeverity = ref('')
const unreadOnly = ref(false)
const typeCount = computed(() => activeAlerts.value.reduce((m, a) => ((m[a.type] = (m[a.type] || 0) + 1), m), {}))
const sevAll = computed(() => activeAlerts.value.reduce((m, a) => ((m[a.severity] = (m[a.severity] || 0) + 1), m), {}))
const byType = computed(() => activeAlerts.value.filter((a) => (!alertType.value || a.type === alertType.value) && (!unreadOnly.value || !isRead(a))))
const sevCount = computed(() => byType.value.reduce((m, a) => ((m[a.severity] = (m[a.severity] || 0) + 1), m), {}))
const shownAlerts = computed(() => byType.value.filter((a) => !alertSeverity.value || a.severity === alertSeverity.value).slice(0, 40))

// ---------- recent ----------
const recentFilter = ref('')
const recent = computed(() => [...state.pickups]
  .filter((p) => !recentFilter.value || (recentFilter.value === 'ongoing' ? p.status === 'ongoing' : p.flags.length))
  .sort((a, b) => (b.endAt || b.startAt).localeCompare(a.endAt || a.startAt)).slice(0, 8))
</script>
<style scoped>
.dash { --mono: var(--font-mono, ui-monospace, Menlo, monospace); --head: var(--font-head, inherit); display: flex; flex-direction: column; gap: 16px; }
.mono { font-family: var(--mono); }
.dash .card + .card { margin-top: 0; }

.welcome { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 22px 28px; border-radius: 12px; color: #fff; position: relative; overflow: hidden;
  background: radial-gradient(circle at 85% 20%, rgba(103, 232, 249, .35), transparent 45%), linear-gradient(100deg, #075985 0%, #0369a1 38%, #0284c7 70%, #0891b2 100%); }
.welcome::after { content: ''; position: absolute; right: -40px; bottom: -60px; width: 360px; height: 160px; border-radius: 50%; border: 28px solid rgba(255, 255, 255, .06); pointer-events: none; }
.w-eyebrow { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #e0f2fe; }
.w-chip { font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: .08em; padding: 3px 10px; border-radius: 999px; background: rgba(255, 255, 255, .18); }
.welcome h2 { margin: 8px 0 6px; font-family: var(--head); font-size: 28px; line-height: 34px; font-weight: 700; letter-spacing: -.02em; }
.welcome p { margin: 0; max-width: 760px; font-size: 14px; line-height: 21px; color: #e0f2fe; }
.w-actions { display: flex; flex-direction: column; gap: 10px; flex: none; z-index: 1; }
.w-btn { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 18px; border-radius: 8px; font: 600 14px var(--font-body, inherit); cursor: pointer; transition: background .15s, transform .15s; }
.w-btn:active { transform: scale(.98); }
.w-btn.glass { background: rgba(255, 255, 255, .14); border: 1px solid rgba(255, 255, 255, .3); color: #fff; }
.w-btn.glass:hover { background: rgba(255, 255, 255, .22); }
.w-btn.solid { background: #fff; border: 0; color: #0369a1; box-shadow: 0 2px 6px rgba(8, 47, 73, .25); }
.w-btn.solid:hover { background: #f0f9ff; }

.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kpi { cursor: pointer; transition: box-shadow .15s, border-color .15s; display: flex; flex-direction: column; }
.kpi:hover { border-color: #cbd5e1; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, .06), 0 2px 4px -2px rgba(15, 23, 42, .04); }
.k-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 500; color: #475569; }
.k-main { display: flex; align-items: baseline; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.k-main b { font-size: 30px; line-height: 34px; font-weight: 600; letter-spacing: -.02em; color: #0f172a; }
.k-main small { font-size: 12px; color: #64748b; }
.k-main .badge { margin-left: auto; align-self: center; }
.k-note { margin-top: 4px; font-size: 12px; color: #64748b; }
.k-foot { display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #475569; }
.k-foot b { font-size: 13px; color: #0f172a; }
.segbar { display: flex; gap: 2px; height: 6px; margin-top: 8px; border-radius: 3px; overflow: hidden; background: #f1f5f9; }
.segbar i { min-width: 0; }

.badge { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.badge i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .8; }
.badge.green { background: #ecfdf5; color: #065f46; }
.badge.amber { background: #fffbeb; color: #92400e; }
.badge.rose { background: #ffe4e6; color: #9f1239; }
.badge.slate { background: #f1f5f9; color: #475569; }

.grid { display: grid; gap: 16px; }
.g-16-8 { grid-template-columns: 2fr 1fr; }
.g-14-10 { grid-template-columns: 7fr 5fr; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.c-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.c-head h3 { margin: 0; font-family: var(--head); font-size: 16px; line-height: 22px; font-weight: 600; color: #0f172a; }
.c-head p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
.c-icon { font-size: 20px; color: #0369a1; align-self: flex-start; margin-top: 1px; }
.push { margin-left: auto; }

.donut-wrap { display: flex; flex-direction: column; }
.legend { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.legend li { display: grid; grid-template-columns: 10px 1fr auto 52px; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 6px; font-size: 13px; color: #334155; cursor: pointer; }
.legend li:hover { background: #f8fafc; }
.legend i { width: 10px; height: 10px; border-radius: 3px; }
.legend b { font-size: 13px; color: #0f172a; }
.legend small { text-align: right; font-size: 11px; color: #64748b; }

.gauges { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.gauge { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 10px 14px; text-align: center; cursor: pointer; background: #fcfdfe; transition: border-color .15s; }
.gauge:hover { border-color: #94a3b8; }
.g-title { font-size: 13px; font-weight: 600; color: #334155; }
.g-cap { margin: -6px 0 8px; font-size: 12px; color: #64748b; }

.rank { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.rank li { cursor: pointer; }
.r-line { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.r-no { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 4px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; }
.r-no.top { background: #fef3c7; color: #92400e; }
.r-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #0f172a; font-weight: 500; }
.r-line b { font-size: 14px; }
.r-line small { width: 92px; text-align: right; font-size: 11px; color: #64748b; }
.r-bar { height: 6px; margin: 6px 0 0 32px; border-radius: 3px; background: #f1f5f9; overflow: hidden; }
.r-bar i { display: block; height: 100%; border-radius: 3px; }
.rank li:hover .r-name { color: #0369a1; }
.rank-foot { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
.rank-foot div { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 8px; background: #f8fafc; }
.rank-foot b { font-size: 20px; font-weight: 600; }
.rank-foot span { font-size: 12px; color: #64748b; }
.nowrap { white-space: nowrap; }
.empty { padding: 24px 0; text-align: center; color: #64748b; }

.alerts-card { display: flex; flex-direction: column; }
.switch-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; cursor: pointer; }
.alert-tools { margin-bottom: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.chips .el-check-tag { font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 999px; }
.scroll { flex: 1; overflow-y: auto; max-height: 440px; border: 1px solid #f1f5f9; border-radius: 8px; }
.id { color: #0369a1; font-weight: 500; }
</style>
