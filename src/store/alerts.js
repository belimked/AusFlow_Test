import { computed, reactive } from 'vue'
import { state, idx, nameOf, plateOf, isOverdue, overdueDays, overdueText, nextService, vehicleLoads, vehicleCycles, traceBackward, fmtL, fmtM, save, nextId, CURRENT_USER } from './db'

export const SUSPICIOUS_RATIO = 1.2
export const UNLOAD_WARN_HOURS = 24
export const UNLOAD_CRITICAL_HOURS = 72
export const REMIND_HOURS = 8
const DAY = 864e5
const RECENT_DAYS = 14

export const ALERT_TYPES = {
  overdue: 'Overdue pump-out',
  longJob: 'Job not finished',
  location: 'Location mismatch',
  capacity: 'Over capacity',
  nolocation: 'No location',
  vehicleFull: 'Vehicle near full',
  haulerBacklog: 'Hauler backlog',
  pendingDriver: 'Driver pending approval',
  vehicleOverload: 'Vehicle overload', unloadOverTank: 'Unload over tank capacity',
  devicePumpedOver: 'Device pumped over daily capacity', unloadDelayed: 'Delayed unload', wasteMismatch: 'Waste type mismatch'
}
export const ALERT_CATEGORIES = { device: 'Device', vehicle: 'Hauler & vehicle', driver: 'Driver', suspicious: 'Suspicious activity' }
const TYPE_CATEGORY = {
  overdue: 'device', capacity: 'device', vehicleFull: 'vehicle', haulerBacklog: 'vehicle',
  longJob: 'driver', location: 'driver', nolocation: 'driver', pendingDriver: 'driver',
  vehicleOverload: 'suspicious', unloadOverTank: 'suspicious', devicePumpedOver: 'suspicious',
  unloadDelayed: 'suspicious', wasteMismatch: 'suspicious'
}
export const SEVERITY = { critical: 'Critical', warning: 'Warning', info: 'Info' }
const BACKLOG_WARN = 3
const BACKLOG_CRITICAL = 10
export const ALERT_STATUS = { open: 'Open', progress: 'In progress', resolved: 'Resolved' }

// Alerts are derived from data, so the ID is a hash of the alert's business key: same condition -> same ID for everyone.
export function alertIdOf(key) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return 'AL-' + (h >>> 0).toString(36).toUpperCase().padStart(7, '0')
}

const devicePoint = (d) => d && typeof d.lat === 'number' && typeof d.lng === 'number' ? [{ lat: d.lat, lng: d.lng, label: 'Device ' + d.ref, color: '#e6a23c' }] : []
const jobPoints = (p) => [
  ...(p.startLat != null && p.startLng != null ? [{ lat: p.startLat, lng: p.startLng, label: 'Job start', color: '#67c23a' }] : []),
  ...(p.endLat != null && p.endLng != null ? [{ lat: p.endLat, lng: p.endLng, label: 'Job end', color: '#f56c6c' }] : [])
]

function vehicleTrail(vehicleId) {
  const ev = [
    ...state.pickups.filter((p) => p.vehicleId === vehicleId && p.endLat != null).map((p) => ({ at: p.endAt, lat: p.endLat, lng: p.endLng })),
    ...state.transfers.filter((t) => t.fromVehicleId === vehicleId || t.toVehicleId === vehicleId)
      .map((t) => ({ at: t.at, lat: t.lat, lng: t.lng, emptied: t.fromVehicleId === vehicleId })),
    ...state.unloads.filter((u) => u.vehicleId === vehicleId).map((u) => ({ at: u.at, lat: u.lat, lng: u.lng, emptied: true }))
  ].sort((a, b) => b.at.localeCompare(a.at))
  return { last: ev.find((e) => e.lat != null && e.lng != null), at: ev.find((e) => e.at)?.at || null }
}

export const alerts = computed(() => {
  const now = Date.now()
  const out = []
  const loc = (id) => nameOf('locations', id)
  const push = (key, type, a) => out.push({ id: alertIdOf(key), alertId: alertIdOf(key), type, category: TYPE_CATEGORY[type], ...a })

  const overdueByCompany = new Map()
  for (const d of state.devices) {
    if (!isOverdue(d)) continue
    if (d.companyId) overdueByCompany.set(d.companyId, [...(overdueByCompany.get(d.companyId) || []), d])
    const days = overdueDays(d)
    push('od:' + d.id + ':' + (d.lastService || ''), 'overdue', {
      severity: days >= 28 ? 'critical' : 'warning',
      title: `${d.ref} overdue for pump-out`,
      detail: `${loc(d.locationId)} · ${overdueText(d)} · ${d.companyId ? nameOf('companies', d.companyId) : 'No hauler assigned'}`,
      at: nextService(d), to: '/devices/' + d.id,
      refs: { deviceId: d.id, locationId: d.locationId, companyId: d.companyId },
      points: devicePoint(d)
    })
  }
  for (const p of state.pickups) {
    const dev = idx.devices.value.get(p.deviceId)
    const refs = { pickupId: p.id, deviceId: p.deviceId, locationId: p.locationId, companyId: p.companyId, vehicleId: p.vehicleId, driverId: p.driverId }
    const points = [...devicePoint(dev), ...jobPoints(p)]
    if (p.status === 'ongoing') {
      const due = new Date(p.startAt).getTime() + REMIND_HOURS * 36e5
      if (due <= now) push('lj:' + p.id, 'longJob', {
        severity: 'critical',
        title: `Job ${p.id} still open after ${((now - new Date(p.startAt)) / 36e5).toFixed(1)} h`,
        detail: `${nameOf('drivers', p.driverId)} · ${plateOf(p.vehicleId)} · ${loc(p.locationId)}`,
        at: new Date(due).toISOString(), to: '/pickups/' + p.id, refs, points
      })
      continue
    }
    if (now - new Date(p.endAt).getTime() > RECENT_DAYS * DAY) continue
    const who = `${nameOf('drivers', p.driverId)} · ${plateOf(p.vehicleId)}`
    if (p.flags.includes('location')) push('lo:' + p.id, 'location', {
      severity: 'warning',
      title: `Pump-out ${p.id} recorded ${fmtM(p.distance)} from device`,
      detail: `${p.deviceId} ${loc(p.locationId)} · ${who}`, at: p.endAt, to: '/pickups/' + p.id, refs, points
    })
    if (p.flags.includes('capacity')) push('ca:' + p.id, 'capacity', {
      severity: 'warning',
      title: `Pump-out ${p.id}: ${fmtL(p.volume)} exceeds device capacity ${fmtL(dev?.capacity)}`,
      detail: `${p.deviceId} ${loc(p.locationId)} · ${who}`, at: p.endAt, to: '/pickups/' + p.id, refs, points
    })
    if (p.flags.includes('nolocation')) push('nl:' + p.id, 'nolocation', {
      severity: 'info',
      title: `Pump-out ${p.id} submitted without location`,
      detail: `${p.deviceId} ${loc(p.locationId)} · ${who}`, at: p.endAt, to: '/pickups/' + p.id, refs, points
    })
  }
  for (const [companyId, list] of overdueByCompany) {
    if (list.length < BACKLOG_WARN) continue
    const oldest = list.reduce((a, b) => (nextService(a) < nextService(b) ? a : b))
    push('hb:' + companyId, 'haulerBacklog', {
      severity: list.length >= BACKLOG_CRITICAL ? 'critical' : 'warning',
      title: `${nameOf('companies', companyId)} has ${list.length} overdue devices`,
      detail: `Oldest: ${oldest.ref} ${loc(oldest.locationId)} · ${overdueText(oldest)}`,
      at: nextService(oldest), to: { path: '/devices', query: { overdue: '1', company: companyId } },
      refs: { companyId, deviceIds: list.map((d) => d.id) },
      points: list.filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number').map((d) => ({ lat: d.lat, lng: d.lng, label: `${d.ref} · ${overdueText(d)}`, color: '#f56c6c' }))
    })
  }
  for (const v of state.vehicles) {
    const load = vehicleLoads.value.get(v.id) || 0
    if (v.status !== 'active' || load / v.tank < 0.9) continue
    const { last, at } = vehicleTrail(v.id)
    push('vf:' + v.id, 'vehicleFull', {
      severity: 'warning',
      title: `Vehicle ${v.plate} is ${Math.round((load / v.tank) * 100)}% full`,
      detail: `${nameOf('companies', v.companyId)} · ${fmtL(load)} / ${fmtL(v.tank)}`, at, to: '/vehicles/' + v.id,
      refs: { vehicleId: v.id, companyId: v.companyId },
      points: last ? [{ lat: last.lat, lng: last.lng, label: `${v.plate} last seen`, color: '#409eff' }] : []
    })
  }
  const recent = (at) => at && now - new Date(at).getTime() <= RECENT_DAYS * DAY && new Date(at).getTime() <= now
  const pickupPoints = (list) => list.flatMap((p) => devicePoint(idx.devices.value.get(p.deviceId)))
  for (const c of vehicleCycles.value) {
    if (c.endAt && !recent(c.endAt)) continue
    const v = idx.vehicles.value.get(c.vehicleId)
    if (!v) continue
    const refs = { vehicleId: v.id, companyId: v.companyId, pickupIds: c.pickups.map((p) => p.id) }
    const key = v.id + ':' + c.firstInflowId
    if (c.inflow > v.tank * SUSPICIOUS_RATIO) push('vo:' + key, 'vehicleOverload', {
      severity: 'critical', title: `Vehicle ${v.plate} collected ${fmtL(c.inflow)} without unloading (tank ${fmtL(v.tank)})`,
      detail: `${c.pickups.length} pump-outs · ${c.transfersIn.length} transfers in · ${nameOf('companies', v.companyId)}`,
      at: c.endAt || c.startAt, to: '/vehicles/' + v.id, refs, points: pickupPoints(c.pickups)
    })
    const hours = ((c.endAt ? new Date(c.endAt).getTime() : now) - new Date(c.startAt).getTime()) / 36e5
    if (hours > UNLOAD_WARN_HOURS) push('ud:' + key, 'unloadDelayed', {
      severity: hours > UNLOAD_CRITICAL_HOURS ? 'critical' : 'warning',
      title: `Vehicle ${v.plate} ${c.endAt ? `took ${hours.toFixed(1)} h to unload` : `still not unloaded after ${hours.toFixed(1)} h`}`,
      detail: `${fmtL(c.inflow)} · ${nameOf('companies', v.companyId)}`,
      at: c.endAt || c.startAt, to: '/vehicles/' + v.id, refs, points: pickupPoints(c.pickups)
    })
  }
  const daily = new Map()
  for (const p of state.pickups) {
    if (p.status !== 'done' || !recent(p.endAt)) continue
    const date = new Date(p.endAt)
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const key = p.deviceId + ':' + day
    if (!daily.has(key)) daily.set(key, { day, list: [] })
    daily.get(key).list.push(p)
  }
  for (const [key, { day, list }] of daily) {
    const d = idx.devices.value.get(list[0].deviceId)
    const volume = list.reduce((n, p) => n + (Number(p.volume) || 0), 0)
    if (!d?.capacity || list.length < 2 || volume <= d.capacity * SUSPICIOUS_RATIO) continue
    push('dp:' + key, 'devicePumpedOver', {
      severity: 'warning', title: `Device ${d.ref} pumped ${fmtL(volume)} on ${day} (capacity ${fmtL(d.capacity)})`,
      detail: `${list.length} pump-outs · ${nameOf('locations', d.locationId)}`, at: list.at(-1).endAt,
      to: '/devices/' + d.id, refs: { deviceId: d.id, locationId: d.locationId, pickupIds: list.map((p) => p.id) }, points: devicePoint(d)
    })
  }
  const sources = (tree) => [...tree.pickups, ...tree.transfersIn.flatMap((t) => sources(t.source))]
  for (const u of state.unloads) {
    if (!recent(u.at)) continue
    const v = idx.vehicles.value.get(u.vehicleId)
    const f = idx.facilities.value.get(u.facilityId)
    const refs = { unloadId: u.id, vehicleId: u.vehicleId, facilityId: u.facilityId, companyId: u.companyId }
    const points = f?.lat != null && f?.lng != null ? [{ lat: f.lat, lng: f.lng, label: f.name, color: '#f56c6c' }] : []
    if (v?.tank && u.volume > v.tank * SUSPICIOUS_RATIO) push('ut:' + u.id, 'unloadOverTank', {
      severity: 'critical', title: `Unload ${u.id}: ${fmtL(u.volume)} exceeds vehicle ${v.plate} tank ${fmtL(v.tank)}`,
      detail: `${f?.name || u.facilityId} · ${nameOf('companies', u.companyId)}`, at: u.at, to: { path: '/trace', query: { unload: u.id } }, refs, points
    })
    if (!u.waste?.trim()) continue
    const mismatch = sources(traceBackward(u.vehicleId, new Date(u.at).getTime())).filter((p) => p.waste?.trim() && p.waste.trim().toLowerCase() !== u.waste.trim().toLowerCase())
    if (mismatch.length) push('wm:' + u.id, 'wasteMismatch', {
      severity: 'critical', title: `Unload ${u.id} waste type differs from source pump-outs`,
      detail: `Declared ${u.waste.trim()}; sources: ${mismatch.map((p) => `${p.waste.trim()} (${p.id})`).join(', ')}`,
      at: u.at, to: { path: '/trace', query: { unload: u.id } },
      refs: { ...refs, pickupIds: mismatch.map((p) => p.id) }, points
    })
  }
  for (const d of state.drivers) {
    if (d.status === 'pending') push('pd:' + d.id, 'pendingDriver', {
      severity: 'info',
      title: `${d.name} is waiting for approval`, detail: nameOf('companies', d.companyId),
      at: d.createdAt, to: { path: '/drivers', query: { status: 'pending' } },
      refs: { driverId: d.id, companyId: d.companyId }, points: []
    })
  }
  return out.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
})

const reads = () => state.alertReads
export const isRead = (a) => !!reads()[a.id]
export const unreadCount = computed(() => alerts.value.filter((a) => !isRead(a)).length)
export function markRead(list) {
  for (const a of list) reads()[a.id] = true
  save()
}

// ---------- follow-up: notes and status changes, newest first ----------
const statusMap = computed(() => {
  const m = new Map()
  for (const n of state.alertNotes) if (n.kind === 'status' && !m.has(n.alertId)) m.set(n.alertId, n.status)
  return m
})
export const statusOf = (alertId) => statusMap.value.get(alertId) || 'open'
export const notesOf = (alertId) => state.alertNotes.filter((n) => n.alertId === alertId)

function addEntry(alertId, entry) {
  state.alertNotes.unshift({ id: nextId('AN'), alertId, status: null, text: '', user: CURRENT_USER, at: new Date().toISOString(), ...entry })
  save()
}
export const addAlertNote = (alertId, text) => addEntry(alertId, { kind: 'note', text })
export const setAlertStatus = (alertId, status) => addEntry(alertId, { kind: 'status', status })

// ---------- detail drawer ----------
export const alertDrawer = reactive({ open: false, alert: null })
export function showAlert(a) {
  markRead([a])
  alertDrawer.alert = a
  alertDrawer.open = true
}
