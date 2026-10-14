import Papa from 'papaparse'

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
const TZ = { AEST: 10, AEDT: 11, ACST: 9.5, ACDT: 10.5, AWST: 8, NZST: 12, NZDT: 13, GMT: 0, UTC: 0 }

// "Wed 24th Dec 2025 13:07:16 AEST" -> ISO string (UTC)
export function parseWasteIdDate(s) {
  const m = (s || '').trim().match(/^\w+ (\d+)\w* (\w{3}) (\d{4}) (\d\d):(\d\d):(\d\d) (\w+)$/)
  if (!m) return null
  const [, d, mon, y, hh, mm, ss, tz] = m
  if (!(mon in MONTHS)) return null
  const utc = Date.UTC(+y, MONTHS[mon], +d, +hh, +mm, +ss) - (TZ[tz] ?? 10) * 3600e3
  return new Date(utc).toISOString()
}

const STATUSES = ['Active', 'Inactive', 'Removed']

export function parseCsvText(text) {
  const res = Papa.parse(text.replace(/\r\n?/g, '\n'), { header: true, skipEmptyLines: true })
  return res.data
}

export const locationKey = (r) => [r['Agreement Numbers'] || '', (r['Address Line 1'] || '').toUpperCase(), r['Location Names'] || ''].join('|')

const num = (v) => {
  const s = (v ?? '').toString().trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

// Maps one CSV row to device fields (without locationId/companyId). Returns { device, errors }.
export function rowToDevice(r) {
  const errors = []
  const ref = (r['Device Ref'] || '').trim()
  if (!ref) errors.push('Missing Device Ref')
  const status = (r['Status'] || '').trim()
  if (!STATUSES.includes(status)) errors.push(`Invalid status: "${status || 'empty'}"`)
  const capacity = num(r['Capacity'])
  if (Number.isNaN(capacity)) errors.push(`Capacity is not a number: "${r['Capacity']}"`)
  const freq = num(r['Service Frequency'])
  if (Number.isNaN(freq)) errors.push(`Service frequency is not a number: "${r['Service Frequency']}"`)
  let lat = num(r['Latitude']), lng = num(r['Longitude'])
  if (Number.isNaN(lat) || Number.isNaN(lng) || (lat != null && (lat < -90 || lat > 90)) || (lng != null && (lng < -180 || lng > 180))) {
    errors.push('Invalid coordinates')
  }
  if (!(r['Location Names'] || '').trim() && !(r['Address Line 1'] || '').trim()) errors.push('Missing location name and address')
  const device = {
    id: ref,
    ref,
    number: (r['Device Number'] || '').trim(),
    aka: (r['Device AKA'] || '').trim(),
    status,
    type: (r['Device Type'] || '').trim(),
    waste: (r['Device Waste'] || '').trim(),
    qr: (r['QR2id / Barcodes'] || '').split(/\s+/).filter(Boolean)[0] || '',
    capacity: capacity ?? 0,
    lat: lat ?? null,
    lng: lng ?? null,
    freqWeeks: freq ?? 0,
    lastService: parseWasteIdDate(r['Last Service']),
    approvalCategory: (r['Approval Category'] || '').trim(),
    risk: (r['Approval Risk'] || '').trim(),
    locationDesc: (r['Device Location Description'] || r['Device Service Info'] || '').trim(),
    comments: (r['Device Comments'] || '').trim()
  }
  return { device, errors }
}

export function rowToLocation(r) {
  return {
    name: (r['Location Names'] || r['Address Line 1'] || '').trim(),
    agreementNo: (r['Agreement Numbers'] || '').trim(),
    address1: (r['Address Line 1'] || '').trim(),
    address2: (r['Address Line 2'] || '').trim(),
    suburb: (r['Suburb'] || '').trim().toUpperCase(),
    state: (r['State'] || '').trim(),
    postcode: (r['Postcode'] || '').trim(),
    status: 'active'
  }
}
