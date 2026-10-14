import rows from '../seed/devices.json'
import { rowToDevice, rowToLocation, locationKey } from './csv'
import { distanceM, nextService } from './db'

const MIN = 6e4, HOUR = 36e5, DAY = 864e5
const HISTORY_DAYS = 14

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
  ['Cleanaway Waste Management Ltd Crestmead', '74 101 155 220', 'Michael Turner', '07 3802 1100', '12 Johnson Rd, Crestmead QLD 4132'],
  ['JJ Richards Underwood', '13 000 943 812', 'Sarah Nguyen', '07 3341 2200', '3 Kingston Rd, Underwood QLD 4119'],
  ['Pump-It Environmental Services', '56 128 334 902', 'David Kelly', '07 3271 3300', '27 Boundary Rd, Rocklea QLD 4106'],
  ['REMONDIS Australia Pty Ltd', '78 002 688 158', 'Emma Wilson', '07 3277 4400', '58 Tile St, Wacol QLD 4076'],
  ['Evoro', '41 615 002 377', 'James Patel', '07 3390 5500', '9 Lytton Rd, Hemmant QLD 4174'],
  ["Lee's Environmental", '22 097 456 118', 'Olivia Chen', '07 3807 6600', '41 Mudgee St, Kingston QLD 4114']
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
    id: id('CO'), name, abn, contact, phone, address, status: 'active'
  }))
  const companyByName = new Map(companies.map((c) => [c.name, c]))

  const locations = [], locByKey = new Map(), devices = []
  for (const r of rows) {
    const key = locationKey(r)
    let loc = locByKey.get(key)
    if (!loc) {
      loc = { id: id('LO'), ...rowToLocation(r), lat: null, lng: null }
      locByKey.set(key, loc)
      locations.push(loc)
    }
    const { device } = rowToDevice(r)
    if (loc.lat == null && device.lat != null) { loc.lat = device.lat; loc.lng = device.lng }
    device.locationId = loc.id
    device.companyId = companyByName.get(normName(r['Serviced By']))?.id ?? null
    devices.push(device)
  }

  const drivers = [], vehicles = [], facilities = []
  companies.forEach((c, ci) => {
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

  for (const c of companies) {
    const cDrivers = drivers.filter((d) => d.companyId === c.id && d.status === 'active')
    const cVehicles = vehicles.filter((v) => v.companyId === c.id && v.status === 'active')
    const cDevices = devices.filter((d) => d.companyId === c.id && d.status === 'Active')
    if (!cDevices.length) continue
    const load = new Map(cVehicles.map((v) => [v.id, 0]))
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
          if (load.get(v.id) + volume > v.tank) break
          const start = t, end = start + between(15, 45) * MIN
          if (end > now) {
            if (!ongoingMade && start < now) {
              ongoingMade = true
              const [sl, sg] = jitter(dev.lat, dev.lng)
              pickups.push({
                id: '', deviceId: dev.id, locationId: dev.locationId, companyId: c.id, driverId: driver.id, vehicleId: v.id,
                volume: null, startAt: iso(start), endAt: null, startLat: sl, startLng: sg, endLat: null, endLng: null,
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
            volume, startAt: iso(start), endAt: iso(end), startLat: sl, startLng: sg, endLat: el, endLng: eg, distance,
            photos: rnd() < 0.6 ? 1 + Math.floor(rnd() * 2) : 0, flags,
            note: flags.includes('location') ? 'Trap is in the rear lane; truck parked at the corner' : '', status: 'done'
          })
          load.set(v.id, load.get(v.id) + volume)
          dev.lastService = iso(end)
          t = end + between(20, 60) * MIN
        }
        const endT = t + between(20, 50) * MIN
        if (endT > now || !load.get(v.id)) continue
        const [lat, lng] = [-27.47 + between(-0.08, 0.08), 153.03 + between(-0.1, 0.1)]
        if (v.type === 'small' && large && rnd() < 0.4) {
          transfers.push({ id: '', companyId: c.id, driverId: driver.id, fromVehicleId: v.id, toVehicleId: large.id, volume: load.get(v.id), at: iso(endT), lat, lng })
          load.set(large.id, load.get(large.id) + load.get(v.id))
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
        volume: null, startAt: iso(now - 9.5 * HOUR), endAt: null, startLat: dev0.lat, startLng: dev0.lng, endLat: null, endLng: null,
        distance: 6, photos: 0, flags: [], note: '', status: 'ongoing'
      })
    }
  }

  pickups.sort((a, b) => a.startAt.localeCompare(b.startAt)).forEach((p) => (p.id = id('PK')))
  transfers.sort((a, b) => a.at.localeCompare(b.at)).forEach((x) => (x.id = id('TR')))
  unloads.sort((a, b) => a.at.localeCompare(b.at)).forEach((x) => (x.id = id('UL')))
  pickups.reverse(); transfers.reverse(); unloads.reverse()

  const changeLogs = []
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
    changeLogs.push({ id: '', deviceId: d.id, field: label, oldValue: String(before ?? ''), newValue: String(after), user, source, at: iso(now - (i + 1) * 0.8 * DAY - between(0, 8) * HOUR) })
  })
  changeLogs.sort((a, b) => a.at.localeCompare(b.at)).forEach((x) => (x.id = id('CL')))
  changeLogs.reverse()

  return {
    seq, locations, devices, companies, drivers, vehicles, facilities, pickups, transfers, unloads,
    changeLogs, importLogs: []
  }
}
