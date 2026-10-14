import { computed, reactive } from 'vue'
import { state, idx, nameOf, plateOf, isOverdue, overdueDays, overdueText, nextService, vehicleLoads, fmtL, fmtM, save, nextId, CURRENT_USER } from './db'

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
  pendingDriver: 'Driver pending approval'
}
export const ALERT_CATEGORIES = { device: 'Device', vehicle: 'Hauler & vehicle', driver: 'Driver' }
const TYPE_CATEGORY = {
  overdue: 'device', capacity: 'device', vehicleFull: 'vehicle', haulerBacklog: 'vehicle',
  longJob: 'driver', location: 'driver', nolocation: 'driver', pendingDriver: 'driver'
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

const devicePoint = (d) => d?.lat != null ? [{ lat: d.lat, lng: d.lng, label: 'Device ' + d.ref, color: '#e6a23c' }] : []
const jobPoints = (p) => [
  ...(p.startLat != null ? [{ lat: p.startLat, lng: p.startLng, label: 'Job start', color: '#67c23a' }] : []),
  ...(p.endLat != null ? [{ lat: p.endLat, lng: p.endLng, label: 'Job end', color: '#f56c6c' }] : [])
]

function vehicleTrail(vehicleId) {
  const ev = [
    ...state.pickups.filter((p) => p.vehicleId === vehicleId && p.endLat != null).map((p) => ({ at: p.endAt, lat: p.endLat, lng: p.endLng })),
    ...state.transfers.filter((t) => t.fromVehicleId === vehicleId || t.toVehicleId === vehicleId)
      .map((t) => ({ at: t.at, lat: t.lat, lng: t.lng, emptied: t.fromVehicleId === vehicleId })),
    ...state.unloads.filter((u) => u.vehicleId === vehicleId).map((u) => ({ at: u.at, lat: u.lat, lng: u.lng, emptied: true }))
  ].sort((a, b) => b.at.localeCompare(a.at))
  return { last: ev.find((e) => e.lat != null), lastEmptied: ev.find((e) => e.emptied)?.at || '' }
}

export const alerts = computed(() => {
  const now = Date.now()
  const out = []
  const loc = (id) => nameOf('locations', id)
  const push = (key, type, a) => out.push({ id: key, alertId: alertIdOf(key), type, category: TYPE_CATEGORY[type], ...a })

  const overdueByCompany = new Map()
  for (const d of state.devices) {
    if (!isOverdue(d)) continue
    if (d.companyId) overdueByCompany.set(d.companyId, [...(overdueByCompany.get(d.companyId) || []), d])
    const days = overdueDays(d)
    push('od:' + d.id + ':' + nextService(d), 'overdue', {
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
      points: list.filter((d) => d.lat != null).map((d) => ({ lat: d.lat, lng: d.lng, label: `${d.ref} · ${overdueText(d)}`, color: '#f56c6c' }))
    })
  }
  for (const v of state.vehicles) {
    const load = vehicleLoads.value.get(v.id) || 0
    if (v.status !== 'active' || load / v.tank < 0.9) continue
    const { last, lastEmptied } = vehicleTrail(v.id)
    push('vf:' + v.id + ':' + lastEmptied, 'vehicleFull', {
      severity: 'warning',
      title: `Vehicle ${v.plate} is ${Math.round((load / v.tank) * 100)}% full`,
      detail: `${nameOf('companies', v.companyId)} · ${fmtL(load)} / ${fmtL(v.tank)}`, at: new Date(now).toISOString(), to: '/vehicles/' + v.id,
      refs: { vehicleId: v.id, companyId: v.companyId },
      points: last ? [{ lat: last.lat, lng: last.lng, label: `${v.plate} last seen`, color: '#409eff' }] : []
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
