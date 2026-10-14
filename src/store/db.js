import { reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { buildSeed } from './seed'
import { api, currentUser } from './api'

const DAY = 864e5
export let CURRENT_USER = ''

const TABLES = ['companies', 'locations', 'devices', 'drivers', 'vehicles', 'facilities', 'pickups', 'transfers', 'unloads', 'changeLogs', 'importLogs', 'alertReads', 'alertNotes']

function emptyState() {
  return {
    seq: {},
    locations: [], devices: [], companies: [], drivers: [], vehicles: [], facilities: [],
    pickups: [], transfers: [], unloads: [], changeLogs: [], importLogs: [], alertReads: {}, alertNotes: []
  }
}

export const state = reactive(emptyState())

// ---------- server sync: diff against the last state the server acknowledged ----------
const rowsOf = (key) => key === 'alertReads' ? Object.keys(state.alertReads).map((id) => ({ id })) : state[key]
const snapshotOf = () => Object.fromEntries(TABLES.map((k) => [k, new Map(rowsOf(k).map((r) => [r.id, JSON.stringify(r)]))]))
const payload = () => Object.fromEntries(TABLES.map((k) => [k, rowsOf(k)]))

let synced = null
let syncedSeq = '{}'
let loaded = false
let saveTimer
let queue = Promise.resolve()

async function flush() {
  const next = snapshotOf()
  const upserts = {}, deletes = {}
  for (const k of TABLES) {
    for (const r of rowsOf(k)) if (synced[k].get(r.id) !== next[k].get(r.id)) (upserts[k] ||= []).push(r)
    for (const id of synced[k].keys()) if (!next[k].has(id)) (deletes[k] ||= []).push(id)
  }
  const seq = JSON.stringify(state.seq)
  if (!Object.keys(upserts).length && !Object.keys(deletes).length && seq === syncedSeq) return
  try {
    await api('/sync', { upserts, deletes, seq: state.seq })
    synced = next
    syncedSeq = seq
  } catch (e) {
    ElMessage.error('Save failed: ' + e.message)
  }
}

export function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { queue = queue.then(flush) }, 300)
}

function markSynced() {
  synced = snapshotOf()
  syncedSeq = JSON.stringify(state.seq)
  loaded = true
}

export const isLoaded = () => loaded
export function refreshUser() {
  const user = currentUser()
  CURRENT_USER = user?.displayName || user?.username || ''
}

export async function loadState() {
  refreshUser()
  const res = await api('/state')
  if (res.empty) return resetDemo()
  const { alertReads, ...rest } = res.data
  Object.assign(state, emptyState(), rest, { seq: res.seq, alertReads: Object.fromEntries(alertReads.map((r) => [r.id, true])) })
  markSynced()
}

export async function resetDemo() {
  clearTimeout(saveTimer)
  await queue
  Object.assign(state, emptyState(), buildSeed())
  await api('/reset', { data: payload(), seq: state.seq })
  markSynced()
}

export function nextId(prefix) {
  state.seq[prefix] = (state.seq[prefix] || 0) + 1
  return prefix + String(state.seq[prefix]).padStart(4, '0')
}

const indexOf = (key) => computed(() => new Map(state[key].map((x) => [x.id, x])))
export const idx = {
  locations: indexOf('locations'), devices: indexOf('devices'), companies: indexOf('companies'),
  drivers: indexOf('drivers'), vehicles: indexOf('vehicles'), facilities: indexOf('facilities'),
  pickups: indexOf('pickups')
}
export const nameOf = (key, id) => idx[key].value.get(id)?.name ?? (id ? id : '—')
export const plateOf = (id) => idx.vehicles.value.get(id)?.plate ?? '—'
export const tagsOf = (d) => (d.tags || d.qr || '').split(/\s+/).filter(Boolean)

// ---------- labels ----------
export const DEVICE_STATUS = { Active: 'Active', Inactive: 'Inactive', Removed: 'Removed' }
export const ENTITY_STATUS = { active: 'Active', inactive: 'Inactive' }
export const DRIVER_STATUS = { pending: 'Pending', active: 'Active', inactive: 'Inactive' }
export const VEHICLE_TYPE = { small: 'Small truck', large: 'Large truck' }
export const DEVICE_FIELDS = {
  locationId: 'Location', ref: 'Device Ref', aka: 'Device name', status: 'Status', type: 'Device type', waste: 'Waste type',
  capacity: 'Capacity (L)', freqWeeks: 'Service frequency (weeks)', lastService: 'Last service', approvalCategory: 'Approval category', risk: 'Risk rating',
  locationDesc: 'Location description', companyId: 'Responsible hauler', qr: 'QR code', tags: 'Tag ID', lat: 'Latitude', lng: 'Longitude', comments: 'Comments'
}

// ---------- service date (W09) ----------
export function nextService(d) {
  if (!d.lastService || !d.freqWeeks) return null
  return new Date(new Date(d.lastService).getTime() + d.freqWeeks * 7 * DAY).toISOString()
}
export function overdueDays(d) {
  if (d.status !== 'Active') return 0
  const n = nextService(d)
  if (!n) return 0
  const diff = Date.now() - new Date(n).getTime()
  return diff > 0 ? Math.ceil(diff / DAY) : 0
}
export const isOverdue = (d) => overdueDays(d) > 0
export function overdueText(d) {
  const days = overdueDays(d)
  if (!days) return ''
  return days < 7 ? `${days} d overdue` : `${Math.floor(days / 7)} wk overdue`
}

// ---------- geo ----------
export function distanceM(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return null
  const R = 6371e3, rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

// ---------- device mutations with change log (W07 / W11 / W13) ----------
function displayValue(field, v) {
  if (v == null || v === '') return ''
  if (field === 'locationId') return nameOf('locations', v)
  if (field === 'companyId') return nameOf('companies', v)
  if (field === 'status') return DEVICE_STATUS[v] || v
  if (field === 'lastService') return fmtDate(v)
  return String(v)
}

export function makeLog(deviceId, field, oldV, newV, source) {
  return {
    id: nextId('CL'), deviceId, field: DEVICE_FIELDS[field] || field,
    oldValue: displayValue(field, oldV), newValue: displayValue(field, newV),
    user: CURRENT_USER, at: new Date().toISOString(), source
  }
}
export function logChange(...args) {
  state.changeLogs.unshift(makeLog(...args))
}

export function diffDevice(dev, patch) {
  return Object.keys(DEVICE_FIELDS).filter((f) => f in patch && (patch[f] ?? '') !== (dev[f] ?? ''))
}

export function updateDevice(id, patch, source = 'Web') {
  const dev = idx.devices.value.get(id)
  const changed = diffDevice(dev, patch)
  for (const f of changed) {
    logChange(id, f, dev[f], patch[f], source)
    dev[f] = patch[f]
  }
  save()
  return changed.length
}

export function createDevice(data, source = 'Web') {
  const dev = { ...data, id: data.ref }
  state.devices.unshift(dev)
  logChange(dev.id, 'Device created', '', dev.ref, source)
  save()
  return dev
}

// ---------- vehicle load ----------
export const vehicleLoads = computed(() => {
  const m = new Map()
  const add = (id, v) => m.set(id, (m.get(id) || 0) + v)
  for (const p of state.pickups) if (p.status === 'done') add(p.vehicleId, p.volume)
  for (const t of state.transfers) { add(t.fromVehicleId, -t.volume); add(t.toVehicleId, t.volume) }
  for (const u of state.unloads) add(u.vehicleId, -u.volume)
  return m
})

// ---------- trace (W22) ----------
// Prototype assumption: a transfer moves the whole load of the source vehicle, and an unload empties the vehicle.
const ts = (s) => new Date(s).getTime()

export function traceForward(pickup) {
  const hops = [{ kind: 'pickup', vehicleId: pickup.vehicleId, at: pickup.endAt, ref: pickup }]
  let v = pickup.vehicleId, t = ts(pickup.endAt)
  for (let guard = 0; guard < 20; guard++) {
    const tr = state.transfers.filter((x) => x.fromVehicleId === v && ts(x.at) >= t).sort((a, b) => ts(a.at) - ts(b.at))[0]
    const un = state.unloads.filter((x) => x.vehicleId === v && ts(x.at) >= t).sort((a, b) => ts(a.at) - ts(b.at))[0]
    if (un && (!tr || ts(un.at) <= ts(tr.at))) {
      hops.push({ kind: 'unload', vehicleId: v, at: un.at, ref: un })
      return { hops, finished: true }
    }
    if (!tr) return { hops, finished: false }
    hops.push({ kind: 'transfer', vehicleId: tr.toVehicleId, at: tr.at, ref: tr })
    v = tr.toVehicleId
    t = ts(tr.at)
  }
  return { hops, finished: false }
}

function windowStart(vehicleId, tEnd) {
  const prev = [
    ...state.unloads.filter((u) => u.vehicleId === vehicleId && ts(u.at) < tEnd).map((u) => ts(u.at)),
    ...state.transfers.filter((x) => x.fromVehicleId === vehicleId && ts(x.at) < tEnd).map((x) => ts(x.at))
  ]
  return prev.length ? Math.max(...prev) : -Infinity
}

// Returns a tree: { vehicleId, pickups: [], transfersIn: [{ transfer, source: tree }] }
export function traceBackward(vehicleId, tEnd, depth = 0) {
  const start = windowStart(vehicleId, tEnd)
  const inWin = (s) => ts(s) > start && ts(s) <= tEnd
  const pickups = state.pickups.filter((p) => p.status === 'done' && p.vehicleId === vehicleId && inWin(p.endAt))
  const transfersIn = depth > 10 ? [] : state.transfers
    .filter((x) => x.toVehicleId === vehicleId && inWin(x.at))
    .map((x) => ({ transfer: x, source: traceBackward(x.fromVehicleId, ts(x.at), depth + 1) }))
  return { vehicleId, pickups, transfersIn }
}

// ---------- formatting ----------
const pad = (n) => String(n).padStart(2, '0')
export function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function fmtTime(s) {
  if (!s) return '—'
  const d = new Date(s)
  return `${fmtDate(s)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fmtL = (v) => (v == null ? '—' : `${Number(v).toLocaleString()} L`)
export const fmtM = (v) => (v == null ? 'No location' : v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${v} m`)
