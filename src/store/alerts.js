import { computed } from 'vue'
import { state, idx, nameOf, plateOf, isOverdue, overdueDays, overdueText, nextService, vehicleLoads, fmtL, fmtM, save } from './db'

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
  pendingDriver: 'Driver pending approval'
}
export const SEVERITY = { critical: 'Critical', warning: 'Warning', info: 'Info' }

export const alerts = computed(() => {
  const now = Date.now()
  const out = []
  const loc = (id) => nameOf('locations', id)

  for (const d of state.devices) {
    if (!isOverdue(d)) continue
    const days = overdueDays(d)
    out.push({
      id: 'od:' + d.id + ':' + nextService(d), type: 'overdue', severity: days >= 28 ? 'critical' : 'warning',
      title: `${d.ref} overdue for pump-out`,
      detail: `${loc(d.locationId)} · ${overdueText(d)} · ${d.companyId ? nameOf('companies', d.companyId) : 'No hauler assigned'}`,
      at: nextService(d), to: '/devices/' + d.id
    })
  }
  for (const p of state.pickups) {
    if (p.status === 'ongoing') {
      const due = new Date(p.startAt).getTime() + REMIND_HOURS * 36e5
      if (due <= now) out.push({
        id: 'lj:' + p.id, type: 'longJob', severity: 'critical',
        title: `Job ${p.id} still open after ${((now - new Date(p.startAt)) / 36e5).toFixed(1)} h`,
        detail: `${nameOf('drivers', p.driverId)} · ${plateOf(p.vehicleId)} · ${loc(p.locationId)}`,
        at: new Date(due).toISOString(), to: '/pickups/' + p.id
      })
      continue
    }
    if (now - new Date(p.endAt).getTime() > RECENT_DAYS * DAY) continue
    const who = `${nameOf('drivers', p.driverId)} · ${plateOf(p.vehicleId)}`
    if (p.flags.includes('location')) out.push({
      id: 'lo:' + p.id, type: 'location', severity: 'warning',
      title: `Pump-out ${p.id} recorded ${fmtM(p.distance)} from device`,
      detail: `${p.deviceId} ${loc(p.locationId)} · ${who}`, at: p.endAt, to: '/pickups/' + p.id
    })
    if (p.flags.includes('capacity')) {
      const cap = idx.devices.value.get(p.deviceId)?.capacity
      out.push({
        id: 'ca:' + p.id, type: 'capacity', severity: 'warning',
        title: `Pump-out ${p.id}: ${fmtL(p.volume)} exceeds device capacity ${fmtL(cap)}`,
        detail: `${p.deviceId} ${loc(p.locationId)} · ${who}`, at: p.endAt, to: '/pickups/' + p.id
      })
    }
    if (p.flags.includes('nolocation')) out.push({
      id: 'nl:' + p.id, type: 'nolocation', severity: 'info',
      title: `Pump-out ${p.id} submitted without location`,
      detail: `${p.deviceId} ${loc(p.locationId)} · ${who}`, at: p.endAt, to: '/pickups/' + p.id
    })
  }
  for (const v of state.vehicles) {
    const load = vehicleLoads.value.get(v.id) || 0
    if (v.status === 'active' && load / v.tank >= 0.9) out.push({
      id: 'vf:' + v.id + ':' + load, type: 'vehicleFull', severity: 'warning',
      title: `Vehicle ${v.plate} is ${Math.round((load / v.tank) * 100)}% full`,
      detail: `${nameOf('companies', v.companyId)} · ${fmtL(load)} / ${fmtL(v.tank)}`, at: new Date(now).toISOString(), to: '/vehicles/' + v.id
    })
  }
  for (const d of state.drivers) {
    if (d.status === 'pending') out.push({
      id: 'pd:' + d.id, type: 'pendingDriver', severity: 'info',
      title: `${d.name} is waiting for approval`, detail: nameOf('companies', d.companyId),
      at: d.createdAt, to: { path: '/drivers', query: { status: 'pending' } }
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
