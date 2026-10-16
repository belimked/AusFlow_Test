import rows from '../seed/devices.json'
import { rowToDevice, rowToLocation, locationKey } from './csv'
import { distanceM, nextService } from './db'

const MIN = 6e4, HOUR = 36e5, DAY = 864e5
const HISTORY_DAYS = 180

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const normName = (s) => (s || '').replace(/\s+/g, ' ').trim()

const COMPANIES = [
  ['Metro Liquid Waste Services', '74 101 155 220', 'Michael Turner', '07 3802 1100', '12 Johnson Rd, Crestmead QLD 4132'],
  ['Riverside Environmental Pty Ltd', '13 000 943 812', 'Sarah Nguyen', '07 3341 2200', '3 Kingston Rd, Underwood QLD 4119'],
  ['Apex Trade Waste Group', '56 128 334 902', 'David Kelly', '07 3271 3300', '27 Boundary Rd, Rocklea QLD 4106'],
  ['Summit Liquid Services', '78 002 688 158', 'Emma Wilson', '07 3277 4400', '58 Tile St, Wacol QLD 4076'],
  ['Clearflow Waste Solutions', '41 615 002 377', 'James Patel', '07 3390 5500', '9 Lytton Rd, Hemmant QLD 4174'],
  ['Peninsula Pumping Co', '22 097 456 118', 'Olivia Chen', '07 3807 6600', '41 Mudgee St, Kingston QLD 4114']
]
const FIRST = ['Jack', 'Liam', 'Noah', 'Ethan', 'Lucas', 'Mason', 'Chloe', 'Ruby', 'Mia', 'Ava', 'Ben', 'Tom', 'Sam', 'Josh', 'Ryan', 'Ella', 'Zoe', 'Luke', 'Matt', 'Dylan', 'Kyle', 'Grace', 'Isla', 'Harry']
const LAST = ['Smith', 'Jones', 'Brown', 'Taylor', 'Martin', 'Walker', 'Harris', 'Lewis', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Hall', 'Allen']
const FACILITIES = [
  ['Pinkenba Liquid Waste Treatment', '45 Eagle Farm Rd, Pinkenba QLD 4008', -27.4237, 153.1180, 'active'],
  ['Wacol Grease Processing Facility', '120 Industrial Ave, Wacol QLD 4076', -27.5952, 152.9315, 'active'],
  ['Yatala Liquid Waste Plant', '8 Darlington Dr, Yatala QLD 4207', -27.7419, 153.2216, 'active'],
  ['Gibson Island Treatment Works', '1 Gibson Island Rd, Murarrie QLD 4172', -27.4440, 153.1310, 'active'],
  ['Narangba Recycling Depot', '22 Potassium St, Narangba QLD 4504', -27.1990, 152.9620, 'inactive']
]

export function buildSeed() {
  const rnd = mulberry32(20261012)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const between = (a, b) => a + rnd() * (b - a)
  const code = (n) => Array.from({ length: n }, () => pick('ABCDEFGHJKLMNPRSTUVWXYZ23456789')).join('')
  const seq = {}
  const id = (p) => { seq[p] = (seq[p] || 0) + 1; return p + String(seq[p]).padStart(4, '0') }
  const now = Date.now()
  const iso = (t) => new Date(t).toISOString()

  const companies = COMPANIES.map(([name, abn, contact, phone, address]) => ({
    id: id('CO'), name, abn, contact, phone, address, status: 'active', types: '["transport"]'
  }))
  const companyByName = new Map(companies.map((c) => [c.name, c]))

  const locations = [], locByKey = new Map(), devices = []
  for (const r of rows) {
    const key = locationKey(r)
    let loc = locByKey.get(key)
    if (!loc) {
      const number = locations.length
      const text = `${r['Location Names'] || ''} ${r['Address Line 1'] || ''}`
      const custodianCategory = number % 20 === 0 ? null
        : /State School|State High|College|TAFE|Hospital|Police|Queensland Health|Department/i.test(text) ? 'government'
          : /Council|Library|Park|Community Centre|Aquatic/i.test(text) ? 'council' : 'private'
      loc = { id: id('LO'), ...rowToLocation(r), custodianCategory, lat: null, lng: null }
      locByKey.set(key, loc)
      locations.push(loc)
    }
    const { device } = rowToDevice(r)
    if (loc.lat == null && device.lat != null) { loc.lat = device.lat; loc.lng = device.lng }
    device.locationId = loc.id
    device.companyId = companyByName.get(normName(r['Serviced By']))?.id ?? null
    devices.push(device)
  }

  // Deterministic company roles and location relationships.
  const propertyGroups = ['Bayside', 'Riverbank', 'Moreton', 'Southside', 'Cedar', 'Harbour', 'Acacia', 'Greenfield', 'Northgate', 'Sunshine']
    .map((n) => ({ id: id('CO'), name: `${n} Property Group Pty Ltd`, status: 'active', types: '["owner"]' }))
  companies.push(...propertyGroups)
  const others = ['Riverland State School', 'Brookfield Shire Council', "St Augustine's College", 'Meadowbrook Community Trust', 'Kingsford City Council']
    .map((n) => ({ id: id('CO'), name: n, status: 'active', types: '["owner"]' }))
  companies.push(...others)
  companies.push({ id: id('CO'), name: 'Urban Utilities', status: 'active', types: '["authority"]' })
  locations.forEach((l, i) => {
    l.ownerId = i % 3 === 0 ? propertyGroups[i % propertyGroups.length].id : null
    if (i % 7 === 0) { l.occupierId = null; return }
    const occ = { id: id('CO'), name: `${l.name} Pty Ltd`, status: 'active', types: '["occupier"]' }
    companies.push(occ)
    l.occupierId = occ.id
  })
  const locById = new Map(locations.map((l) => [l.id, l]))
  let othersIdx = 0
  for (const d of devices) {
    const l = locById.get(d.locationId)
    d.ownerId = l?.occupierId || l?.ownerId || others[othersIdx++ % others.length].id
  }

  const drivers = [], vehicles = [], facilities = []
  companies.slice(0, 6).forEach((c, ci) => {
    for (let i = 0; i < 4; i++) {
      const first = pick(FIRST), last = pick(LAST)
      const status = i === 3 && ci % 2 === 0 ? 'pending' : i === 3 && ci === 5 ? 'inactive' : 'active'
      drivers.push({
        id: id('DR'), companyId: c.id, name: `${first} ${last}`, account: `${first[0]}${last}`.toLowerCase() + (ci + 1),
        phone: `04${Math.floor(between(10, 99))} ${Math.floor(between(100, 999))} ${Math.floor(between(100, 999))}`,
        status, createdAt: iso(now - between(1, 400) * DAY)
      })
    }
    for (const [type, tank] of [['small', 4000], ['small', 5000], ['large', ci % 2 ? 15000 : 20000]]) {
      vehicles.push({
        id: id('VE'), companyId: c.id, plate: `${Math.floor(between(100, 999))} ${code(3)}`, type, tank,
        qr: 'VH' + code(10), status: 'active'
      })
    }
  })
  vehicles[vehicles.length - 2].status = 'inactive'
  for (const [name, address, lat, lng, status] of FACILITIES) {
    facilities.push({ id: id('FA'), name, address, lat, lng, qr: 'FA' + code(10), status })
  }
  const activeFacilities = facilities.filter((f) => f.status === 'active')

  const pickups = [], transfers = [], unloads = []
  const jitter = (lat, lng) => {
    const r = rnd()
    if (r < 0.04 || lat == null) return [null, null]
    const m = r < 0.9 ? between(0, 80) : between(250, 900)
    const ang = between(0, Math.PI * 2)
    return [lat + (m * Math.sin(ang)) / 111320, lng + (m * Math.cos(ang)) / (111320 * Math.cos((lat * Math.PI) / 180))]
  }
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0)

  for (const c of companies.slice(0, 6)) {
    const cDrivers = drivers.filter((d) => d.companyId === c.id && d.status === 'active')
    const cVehicles = vehicles.filter((v) => v.companyId === c.id && v.status === 'active')
    const cDevices = devices.filter((d) => d.companyId === c.id && d.status === 'Active')
    if (!cDevices.length) continue
    const load = new Map(cVehicles.map((v) => [v.id, 0]))
    const loadWaste = new Map()
    let ongoingMade = false

    for (let dd = HISTORY_DAYS - 1; dd >= 0; dd--) {
      const base = today0.getTime() - dd * DAY
      if (new Date(base).getDay() === 0) continue
      const pickedToday = new Set()
      const working = cVehicles.filter(() => rnd() > 0.3)
      const large = working.find((v) => v.type === 'large')
      const largeArrivals = []
      for (const v of [...working.filter((x) => x.type === 'small'), ...(large ? [large] : [])]) {
        const driver = pick(cDrivers)
        let t = base + 5 * HOUR + between(0, 90) * MIN
        const n = v.type === 'small' ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2)
        for (let k = 0; k < n; k++) {
          const candidates = cDevices.filter((d) => !pickedToday.has(d.id) && (v.type === 'small' || d.capacity >= 2000))
          if (!candidates.length) break
          candidates.sort((a, b) => (nextService(a) || '9') .localeCompare(nextService(b) || '9'))
          const dev = candidates[Math.floor(rnd() * Math.min(4, candidates.length))]
          const overCap = rnd() < 0.05
          const volume = Math.max(50, Math.round((dev.capacity * (overCap ? 1.1 : between(0.55, 0.95))) / 10) * 10)
          if (load.get(v.id) + volume > v.tank || (loadWaste.has(v.id) && loadWaste.get(v.id) !== (normName(dev.waste) || 'Grease Trap Waste'))) break
          const start = t, end = start + between(15, 45) * MIN
          if (end > now) {
            if (!ongoingMade && start < now) {
              ongoingMade = true
              const [sl, sg] = jitter(dev.lat, dev.lng)
              pickups.push({
                id: '', deviceId: dev.id, locationId: dev.locationId, companyId: c.id, driverId: driver.id, vehicleId: v.id,
                volume: null, waste: normName(dev.waste) || 'Grease Trap Waste', startAt: iso(start), endAt: null, startLat: sl, startLng: sg, endLat: null, endLng: null,
                distance: distanceM(dev.lat, dev.lng, sl, sg), photos: 0, flags: [], note: '', status: 'ongoing'
              })
            }
            break
          }
          pickedToday.add(dev.id)
          const [sl, sg] = jitter(dev.lat, dev.lng)
          const [el, eg] = sl == null ? [null, null] : [sl + between(-5, 5) / 111320, sg + between(-5, 5) / 111320]
          const distance = distanceM(dev.lat, dev.lng, el, eg)
          const flags = []
          if (distance != null && distance > 200) flags.push('location')
          if (el == null) flags.push('nolocation')
          if (volume > dev.capacity) flags.push('capacity')
          pickups.push({
            id: '', deviceId: dev.id, locationId: dev.locationId, companyId: c.id, driverId: driver.id, vehicleId: v.id,
            volume, waste: normName(dev.waste) || 'Grease Trap Waste', startAt: iso(start), endAt: iso(end), startLat: sl, startLng: sg, endLat: el, endLng: eg, distance,
            photos: rnd() < 0.6 ? 1 + Math.floor(rnd() * 2) : 0, flags,
            note: flags.includes('location') ? 'Trap is in the rear lane; truck parked at the corner' : '', status: 'done'
          })
          load.set(v.id, load.get(v.id) + volume)
          loadWaste.set(v.id, normName(dev.waste) || 'Grease Trap Waste')
          dev.lastService = iso(end)
          t = end + between(20, 60) * MIN
        }
        const endT = t + between(20, 50) * MIN
        if (endT > now || !load.get(v.id)) continue
        const [lat, lng] = [-27.47 + between(-0.08, 0.08), 153.03 + between(-0.1, 0.1)]
        if (v.type === 'small' && large && (!loadWaste.has(large.id) || loadWaste.get(large.id) === loadWaste.get(v.id)) && load.get(large.id) + load.get(v.id) <= large.tank && rnd() < 0.4) {
          transfers.push({ id: '', companyId: c.id, driverId: driver.id, fromVehicleId: v.id, toVehicleId: large.id, volume: load.get(v.id), at: iso(endT), lat, lng })
          load.set(large.id, load.get(large.id) + load.get(v.id))
          loadWaste.set(large.id, loadWaste.get(v.id))
          largeArrivals.push(endT)
        } else {
          const f = pick(activeFacilities)
          unloads.push({ id: '', companyId: c.id, driverId: driver.id, vehicleId: v.id, facilityId: f.id, volume: load.get(v.id), at: iso(endT), lat: f.lat, lng: f.lng })
        }
        load.set(v.id, 0)
        if (v === large && largeArrivals.length) {
          // large vehicle unloaded above already includes transfers that arrived before; later arrivals stay on board
          const last = unloads[unloads.length - 1]
          if (last && last.vehicleId === v.id) {
            const t2 = Math.max(endT, ...largeArrivals) + 40 * MIN
            if (t2 < now) last.at = iso(t2)
            else { unloads.pop(); load.set(v.id, last.volume) }
          }
        }
        if (!load.get(v.id)) loadWaste.delete(v.id)
      }
    }
  }

  // a forgotten job (> 8h) to demonstrate the reminder (Q05)
  const c0 = companies[1]
  const dev0 = devices.find((d) => d.companyId === c0.id && d.status === 'Active' && d.lat != null)
  if (dev0) {
    const v0 = vehicles.find((v) => v.companyId === c0.id && v.type === 'small' && v.status === 'active')
    const d0 = drivers.find((d) => d.companyId === c0.id && d.status === 'active' && !pickups.some((p) => p.status === 'ongoing' && p.driverId === d.id))
    if (v0 && d0) {
      pickups.push({
        id: '', deviceId: dev0.id, locationId: dev0.locationId, companyId: c0.id, driverId: d0.id, vehicleId: v0.id,
        volume: null, waste: normName(dev0.waste) || 'Grease Trap Waste', startAt: iso(now - 9.5 * HOUR), endAt: null, startLat: dev0.lat, startLng: dev0.lng, endLat: null, endLng: null,
        distance: 6, photos: 0, flags: [], note: '', status: 'ongoing'
      })
    }
  }

  // Dedicated trucks keep the suspicious examples independent of normal routes.
  const co = companies[0], driver = drivers.find((d) => d.companyId === co.id && d.status === 'active')
  const devs = devices.filter((d) => d.companyId === co.id && d.status === 'Active' && d.capacity >= 1000 && d.lat != null)
  const facility = activeFacilities[0]
  const truck = (tank) => {
    const v = { id: id('VE'), companyId: co.id, plate: `${Math.floor(between(100, 999))} ${code(3)}`, type: 'small', tank, qr: 'VH' + code(10), status: 'active' }
    vehicles.push(v)
    return v
  }
  const bigTruck = (tank) => {
    const v = { id: id('VE'), companyId: co.id, plate: `${Math.floor(between(100, 999))} ${code(3)}`, type: 'large', tank, qr: 'VH' + code(10), status: 'active' }
    vehicles.push(v)
    return v
  }
  const job = (v, d, volume, hoursAgo) => {
    const end = now - hoursAgo * HOUR
    pickups.push({ id: '', deviceId: d.id, locationId: d.locationId, companyId: co.id, driverId: driver.id, vehicleId: v.id,
      volume, waste: normName(d.waste) || 'Grease Trap Waste', startAt: iso(end - 30 * MIN), endAt: iso(end),
      startLat: d.lat, startLng: d.lng, endLat: d.lat, endLng: d.lng, distance: 0, photos: 0, flags: [], note: '', status: 'done' })
  }
  const discharge = (v, volume, hoursAgo, waste = '') => unloads.push({ id: '', companyId: co.id, driverId: driver.id,
    vehicleId: v.id, facilityId: facility.id, volume, waste, at: iso(now - hoursAgo * HOUR), lat: facility.lat, lng: facility.lng })
  const xfer = (from, to, volume, hoursAgo, point) => transfers.push({ id: '', companyId: co.id, driverId: driver.id,
    fromVehicleId: from.id, toVehicleId: to.id, volume, at: iso(now - hoursAgo * HOUR), lat: point.lat, lng: point.lng })
  if (devs.length >= 2) {
    const a = devs.find((d) => normName(d.waste).toLowerCase() === 'grease trap waste') || devs[0]
    const b = devs.find((d) => d.id !== a.id)
    const overloaded = truck(2000)
    job(overloaded, a, 1400, 5); job(overloaded, b, 1300, 4)
    const overTank = truck(2000)
    job(overTank, a, 2600, 3.5); discharge(overTank, 2600, 3)
    const delayed = truck(4000)
    job(delayed, a, 900, 30)
    const mismatched = truck(4000)
    job(mismatched, a, 800, 2.5); discharge(mismatched, 800, 2, 'Oily Water')
    const daily = truck(4000), d = devs.find((x) => x.capacity <= 2500) || a
    job(daily, d, Math.round(d.capacity * 0.7), 1.5)
    job(daily, d, Math.round(d.capacity * 0.7), 1)
    // Transfer exceeds receiving capacity: a partly loaded large truck receives more than it can hold.
    const bigA = bigTruck(15000)
    job(bigA, a, 14000, 12)
    const feederA = truck(4000)
    job(feederA, a, 3000, 11)
    xfer(feederA, bigA, 3000, 10, a)
    const bigB = bigTruck(20000)
    job(bigB, b, 19000, 9)
    const feederB = truck(4000)
    job(feederB, b, 2500, 8)
    xfer(feederB, bigB, 2500, 7, b)
  }

  pickups.sort((a, b) => a.startAt.localeCompare(b.startAt)).forEach((p) => (p.id = id('PK')))
  transfers.sort((a, b) => a.at.localeCompare(b.at)).forEach((x) => (x.id = id('TR')))
  unloads.sort((a, b) => a.at.localeCompare(b.at)).forEach((x) => (x.id = id('UL')))
  pickups.reverse(); transfers.reverse(); unloads.reverse()
  // Whole-load provenance, calculated before assigning the seed to reactive state.
  const recentCutoff = iso(now - 14 * DAY)
  const sources = (vehicleId, end, depth = 0) => {
    if (depth > 10) return []
    const previous = [
      ...unloads.filter((u) => u.vehicleId === vehicleId && u.at < end).map((u) => u.at),
      ...transfers.filter((t) => t.fromVehicleId === vehicleId && t.at < end).map((t) => t.at)
    ].sort().at(-1) || ''
    return [
      ...pickups.filter((p) => p.status === 'done' && p.vehicleId === vehicleId && p.endAt > previous && p.endAt <= end),
      ...transfers.filter((t) => t.toVehicleId === vehicleId && t.at > previous && t.at <= end)
        .flatMap((t) => sources(t.fromVehicleId, t.at, depth + 1))
    ]
  }
  for (const u of unloads) {
    if (u.waste || u.at < recentCutoff) continue
    const counts = new Map()
    for (const p of sources(u.vehicleId, u.at)) counts.set(p.waste, (counts.get(p.waste) || 0) + 1)
    u.waste = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || ''
  }

  // Intentional duplicate and app allocations for tag audit demonstrations.
  const tagged = devices.filter((d) => (d.tags || d.qr || '').trim())
  if (tagged.length >= 2) {
    const shared = (tagged[0].tags || tagged[0].qr).split(/\s+/)[0]
    tagged[1].tags = shared
    tagged[1].qr = shared
  }
  const changeLogs = []
  tagged.slice(0, 4).forEach((d, i) => {
    changeLogs.push({ id: '', deviceId: d.id, entityType: 'device', entityId: d.id, field: 'Tag ID',
      oldValue: '', newValue: d.tags || d.qr, source: 'App', user: 'inspector01 (Authority App)', at: iso(now - (i + 1) * DAY) })
  })
  const SAMPLE_CHANGES = [
    ['capacity', 'Capacity (L)', (d) => d.capacity, (d) => d.capacity + 500, 'Web', 'admin (Authority)'],
    ['freqWeeks', 'Service frequency (weeks)', (d) => d.freqWeeks, () => 8, 'Web', 'admin (Authority)'],
    ['locationDesc', 'Location description', (d) => d.locationDesc, (d) => (d.locationDesc ? d.locationDesc + '; ' : '') + 'Access moved to rear lane', 'App', 'inspector01 (Authority App)'],
    ['lat', 'Latitude', (d) => d.lat?.toFixed(6), (d) => (d.lat + 0.0002).toFixed(6), 'App', 'inspector01 (Authority App)']
  ]
  devices.filter((d) => d.status === 'Active' && d.lat != null).slice(0, 12).forEach((d, i) => {
    const [field, label, oldV, newV, source, user] = SAMPLE_CHANGES[i % SAMPLE_CHANGES.length]
    const before = oldV(d), after = newV(d)
    if (field === 'lat') d.lat = +after
    else d[field] = after
    changeLogs.push({ id: '', deviceId: d.id, entityType: 'device', entityId: d.id, field: label, oldValue: String(before ?? ''), newValue: String(after), user, source, at: iso(now - (i + 1) * 0.8 * DAY - between(0, 8) * HOUR) })
  })
  changeLogs.sort((a, b) => a.at.localeCompare(b.at)).forEach((x) => (x.id = id('CL')))
  changeLogs.reverse()

  const inspections = Array.from({ length: 30 }, (_, i) => ({ id: id('IN'), deviceId: devices[(i * 13) % devices.length].id,
    inspector: ['inspector01', 'inspector02', 'inspector03'][i % 3], at: iso(now - (i * 6 + 1) * DAY),
    result: i % 5 === 0 ? (i % 2 ? 'follow_up' : 'non_compliant') : 'compliant',
    comments: i % 5 === 0 ? 'Follow-up recommended.' : 'Equipment checked and compliant.', nextInspection: null, source: 'App' })).reverse()
  const categories = ['baffle_damaged', 'no_washdown_tap', 'premises_closed', 'no_access', 'qr_missing', 'other']
  const reportedIssues = Array.from({ length: 10 }, (_, i) => ({ id: id('RI'), deviceId: devices[(i * 17) % devices.length].id,
    category: categories[i % categories.length], description: ['Baffle needs repair.', 'Tap unavailable on site.', 'Access blocked at gate.', 'Please inspect on next visit.'][i % 4],
    reportedBy: drivers[i % drivers.length].name, at: iso(now - (i * 5 + 1) * DAY), status: i % 2 ? 'resolved' : 'open', source: 'App' })).reverse()
  return {
    inspections, reportedIssues, seq, locations, devices, companies, drivers, vehicles, facilities, pickups, transfers, unloads,
    changeLogs, importLogs: []
  }
}
