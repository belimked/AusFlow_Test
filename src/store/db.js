import { reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { buildSeed } from './seed'
import { api, authHeaders, currentUser, can, logout } from './api'

const DAY = 864e5
export let CURRENT_USER = ''

const TABLES = ['companies', 'locations', 'devices', 'drivers', 'vehicles', 'facilities', 'pickups', 'transfers', 'unloads', 'changeLogs', 'importLogs', 'alertReads', 'alertNotes', 'notes', 'inspections', 'reportedIssues']

function emptyState() {
  return {
    seq: {},
    locations: [], devices: [], companies: [], drivers: [], vehicles: [], facilities: [],
    pickups: [], transfers: [], unloads: [], changeLogs: [], importLogs: [], alertReads: {}, alertNotes: [], notes: [], inspections: [], reportedIssues: []
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
let savePending = false   // a save is scheduled or running
let saving = 0

// Local rows that differ from what the server last acknowledged.
function localChanges() {
  const next = snapshotOf()
  const upserts = {}, deletes = {}
  for (const k of TABLES) {
    for (const r of rowsOf(k)) if (synced[k].get(r.id) !== next[k].get(r.id)) (upserts[k] ||= []).push(r)
    for (const id of synced[k].keys()) if (!next[k].has(id)) (deletes[k] ||= []).push(id)
  }
  const seq = JSON.stringify(state.seq)
  const any = Object.keys(upserts).length > 0 || Object.keys(deletes).length > 0 || seq !== syncedSeq
  return { next, upserts, deletes, seq, any }
}

async function flush() {
  saving++
  try {
    const { next, upserts, deletes, seq, any } = localChanges()
    if (!any) return
    try {
      await api('/sync', { upserts, deletes, seq: state.seq })
      synced = next
      syncedSeq = seq
    } catch (e) {
      ElMessage.error('Save failed: ' + e.message)
    }
  } finally {
    saving--
  }
}

export function save() {
  if (!can('write')) return
  savePending = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { savePending = false; queue = queue.then(flush) }, 300)
}

// ---------- live refresh: pick up what the driver app and other users saved ----------
// The state is re-fetched on navigation, when the tab becomes visible and every 30 s. Local edits that are still
// being saved are never overwritten: a refresh is skipped while anything is pending.
const REFRESH_MS = 30000
let etag = ''
let lastRefresh = 0
let refreshing = null
let autoRefresh = false

const dirty = () => savePending || saving > 0 || (synced && localChanges().any)

async function fetchState() {
  const res = await fetch('/api/state', { headers: { ...authHeaders(), ...(etag ? { 'If-None-Match': etag } : {}) } })
  if (res.status === 304) return null
  if (res.status === 401) { logout(); location.hash = '#/login'; throw new Error('Not signed in') }
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  etag = res.headers.get('ETag') || ''
  return res.json()
}

// Lists come back in database order; show them A–Z by name / plate (the iOS console orders its lists the same way).
const byName = (key) => (a, b) => String(a[key] || '').localeCompare(String(b[key] || ''), undefined, { numeric: true, sensitivity: 'base' })
export function sortLists(data) {
  for (const k of ['companies', 'drivers', 'locations', 'facilities']) if (Array.isArray(data[k])) data[k].sort(byName('name'))
  if (Array.isArray(data.vehicles)) data.vehicles.sort(byName('plate'))
  return data
}

function applyServer(res) {
  const { alertReads, ...rest } = res.data
  Object.assign(state, emptyState(), sortLists(rest), { seq: res.seq, alertReads: Object.fromEntries(alertReads.map((r) => [r.id, true])) })
  markSynced()
}

export function refreshState({ force = false } = {}) {
  if (!loaded) return Promise.resolve()
  if (refreshing) return refreshing
  if (!force && Date.now() - lastRefresh < 5000) return Promise.resolve()
  if (dirty()) return Promise.resolve()
  refreshing = (async () => {
    try {
      const res = await fetchState()
      lastRefresh = Date.now()
      if (res && !res.empty && !dirty()) applyServer(res)
    } catch {
      // try again on the next trigger
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

function startAutoRefresh() {
  if (autoRefresh || typeof window === 'undefined') return
  autoRefresh = true
  setInterval(() => { if (document.visibilityState === 'visible') refreshState() }, REFRESH_MS)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshState({ force: true }) })
  window.addEventListener('focus', () => refreshState())
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
  const res = await fetchState()
  if (!res) return
  if (res.empty) return resetDemo()
  applyServer(res)
  lastRefresh = Date.now()
  startAutoRefresh()
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
export const companyTypes = (c) => { try { return Array.isArray(c?.types) ? c.types : JSON.parse(c?.types || '["transport"]') } catch { return ['transport'] } }
export const isTransport = (c) => companyTypes(c).includes('transport')
export const transports = computed(() => state.companies.filter(isTransport))
export const COMPANY_TYPES = { transport: 'Transport company', owner: 'Owner', occupier: 'Occupier', facility_operator: 'Facility operator', authority: 'Authority' }
export const INSPECTION_RESULTS = { compliant: 'Compliant', non_compliant: 'Non-compliant', follow_up: 'Follow-up required' }
export const ISSUE_CATEGORIES = { baffle_damaged: 'Baffle damaged', no_washdown_tap: 'No wash-down tap', premises_closed: 'Premises closed / renovating', no_access: 'No access', qr_missing: 'QR tag missing', other: 'Other' }
export const nameOf = (key, id) => idx[key].value.get(id)?.name ?? (id ? id : '—')
export const plateOf = (id) => idx.vehicles.value.get(id)?.plate ?? '—'
export const tagsOf = (d) => (d.tags || d.qr || '').split(/\s+/).filter(Boolean)

// ---------- labels ----------
export const CUSTODIAN = { private: 'Private', government: 'Government', council: 'Council', other: 'Other' }
export const DEVICE_STATUS = { Active: 'Active', Inactive: 'Inactive', Removed: 'Removed' }
export const ENTITY_STATUS = { active: 'Active', inactive: 'Inactive' }
export const DRIVER_STATUS = { pending: 'Pending', active: 'Active', inactive: 'Inactive' }
export const VEHICLE_TYPE = { small: 'Small truck', large: 'Large truck' }
export const DEVICE_FIELDS = {
  locationId: 'Location', ref: 'Device Ref', aka: 'Device name', status: 'Status', type: 'Device type', waste: 'Waste type',
  capacity: 'Capacity (L)', freqWeeks: 'Service frequency (weeks)', lastService: 'Last service', approvalCategory: 'Approval category', risk: 'Risk rating',
  locationDesc: 'Location description', companyId: 'Responsible transport company', ownerId: 'Owner', qr: 'QR code', tags: 'Tag ID', lat: 'Latitude', lng: 'Longitude', comments: 'Comments'
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
  if (field === 'companyId' || field === 'ownerId') return nameOf('companies', v)
  if (field === 'status') return DEVICE_STATUS[v] || v
  if (field === 'lastService') return fmtDate(v)
  return String(v)
}

export function makeLog(deviceId, field, oldV, newV, source) {
  return {
    id: nextId('CL'), deviceId, entityType: 'device', entityId: deviceId, field: DEVICE_FIELDS[field] || field,
    oldValue: displayValue(field, oldV), newValue: displayValue(field, newV),
    user: CURRENT_USER, at: new Date().toISOString(), source
  }
}
export function logChange(...args) {
  state.changeLogs.unshift(makeLog(...args))
}

export function logEntityChange(entityType, entityId, field, oldV, newV, source = 'Web') {
  state.changeLogs.unshift({ id: nextId('CL'), deviceId: null, entityType, entityId, field,
    oldValue: String(oldV ?? ''), newValue: String(newV ?? ''), user: CURRENT_USER, source, at: new Date().toISOString() })
  save()
}

export function addEntityNote(entityType, entityId, text, source = 'Web') {
  state.notes.unshift({ id: nextId('NT'), entityType, entityId, text: text.trim(), user: CURRENT_USER, source, at: new Date().toISOString() })
  logEntityChange(entityType, entityId, 'Note added', '', text.trim(), source)
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

// Build load cycles once per state change, in event order. A clear ends the current cycle.
export const vehicleCycles = computed(() => {
  const events = [
    ...state.pickups.filter((p) => p.status === 'done' && p.endAt).map((p) => ({ at: p.endAt, id: p.id, vehicleId: p.vehicleId, kind: 'pickup', ref: p })),
    ...state.transfers.flatMap((t) => [
      { at: t.at, id: t.id, vehicleId: t.fromVehicleId, kind: 'transfer', ref: t },
      { at: t.at, id: t.id, vehicleId: t.toVehicleId, kind: 'transferIn', ref: t }
    ]),
    ...state.unloads.map((u) => ({ at: u.at, id: u.id, vehicleId: u.vehicleId, kind: 'unload', ref: u }))
  ].sort((a, b) => a.at.localeCompare(b.at) || ({ pickup: 0, transferIn: 1, transfer: 2, unload: 3 }[a.kind] - { pickup: 0, transferIn: 1, transfer: 2, unload: 3 }[b.kind]) || a.id.localeCompare(b.id))
  const active = new Map(), cycles = []
  for (const e of events) {
    let c = active.get(e.vehicleId)
    if (e.kind === 'pickup' || e.kind === 'transferIn') {
      if (!c) {
        c = { vehicleId: e.vehicleId, startAt: e.at, firstInflowId: e.id, endAt: null, endKind: null, endRef: null, inflow: 0, pickups: [], transfersIn: [] }
        active.set(e.vehicleId, c)
        cycles.push(c)
      }
      c.inflow += Number(e.ref.volume) || 0
      if (e.kind === 'pickup') c.pickups.push(e.ref)
      else c.transfersIn.push(e.ref)
    } else {
      if (c) { c.endAt = e.at; c.endKind = e.kind; c.endRef = e.ref }
      active.delete(e.vehicleId)
    }
  }
  return cycles
})

// ---------- trace (W22) ----------
// Prototype assumption: a transfer moves the whole load of the source vehicle, and an unload empties the vehicle.
const ts = (s) => new Date(s).getTime()

const forwardEvents = computed(() => {
  const byVehicle = new Map()
  for (const x of state.transfers) {
    if (!byVehicle.has(x.fromVehicleId)) byVehicle.set(x.fromVehicleId, [])
    byVehicle.get(x.fromVehicleId).push({ kind: 'transfer', at: x.at, ref: x })
  }
  for (const u of state.unloads) {
    if (!byVehicle.has(u.vehicleId)) byVehicle.set(u.vehicleId, [])
    byVehicle.get(u.vehicleId).push({ kind: 'unload', at: u.at, ref: u })
  }
  for (const events of byVehicle.values()) events.sort((a, b) => a.at.localeCompare(b.at))
  return byVehicle
})
function nextForwardEvent(vehicleId, at) {
  const events = forwardEvents.value.get(vehicleId) || []
  let lo = 0, hi = events.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (events[mid].at < at) lo = mid + 1
    else hi = mid
  }
  return events[lo]
}
export function traceForward(pickup) {
  const hops = [{ kind: 'pickup', vehicleId: pickup.vehicleId, at: pickup.endAt, ref: pickup }]
  let v = pickup.vehicleId, t = ts(pickup.endAt)
  for (let guard = 0; guard < 20; guard++) {
    const event = nextForwardEvent(v, new Date(t).toISOString())
    if (event?.kind === 'unload') {
      const un = event.ref
      hops.push({ kind: 'unload', vehicleId: v, at: un.at, ref: un })
      return { hops, finished: true }
    }
    if (!event) return { hops, finished: false }
    const tr = event.ref
    hops.push({ kind: 'transfer', vehicleId: tr.toVehicleId, at: tr.at, ref: tr })
    v = tr.toVehicleId
    t = ts(tr.at)
  }
  return { hops, finished: false }
}

// One reactive pass for all jobs; consumers reuse the same trace and destination.
export const pickupDeliveries = computed(() => {
  const result = new Map()
  for (const p of state.pickups) {
    if (p.status === 'ongoing') { result.set(p.id, { status: 'In progress', key: 'progress', vehicleId: p.vehicleId }); continue }
    const trace = traceForward(p)
    const unload = trace.finished ? trace.hops.at(-1).ref : null
    result.set(p.id, { status: unload ? 'Delivered' : 'Pending', key: unload ? 'delivered' : 'pending',
      unload, vehicleId: trace.hops.at(-1).vehicleId, facilityId: unload?.facilityId })
  }
  return result
})

export const unloadSources = (u) => {
  const result = []
  const walk = (tree) => {
    result.push(...tree.pickups)
    for (const t of tree.transfersIn) walk(t.source)
  }
  walk(traceBackward(u.vehicleId, new Date(u.at).getTime()))
  return result
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
