// Straight-line speed is a lower bound on the speed the vehicle actually travelled.
export const FAST_MIN_M = 1000
export const FAST_MAX_KMH = 100
export function fastLeg(gapMs, metres) {
  if (gapMs == null || metres == null || !Number.isFinite(gapMs) || !Number.isFinite(metres)) return { fast: false, kmh: null }
  const kmh = metres / Math.max(gapMs, 1000) * 3600
  return { fast: metres >= FAST_MIN_M && kmh > FAST_MAX_KMH, kmh }
}

export const localDay = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const pos = (lat, lng) => (lat == null || lng == null ? null : { lat, lng })
const ms = (s) => (s ? new Date(s).getTime() : null)

// Shared step chronology for Working days and derived alerts. A pickup starts at startAt,
// while transfers and unloads are instantaneous; legs never cross a local-day boundary.
export function driverSteps(data, driverId) {
  const out = []
  for (const p of data.pickups) {
    if (p.driverId !== driverId || !p.startAt) continue
    const startPos = pos(p.startLat, p.startLng)
    out.push({ kind: 'pickup', id: p.id, vehicleId: p.vehicleId, ref: p,
      start: ms(p.startAt), end: ms(p.endAt), startPos, endPos: pos(p.endLat, p.endLng) || startPos })
  }
  for (const t of data.transfers) {
    if (t.driverId !== driverId || !t.at) continue
    const at = ms(t.at), p = pos(t.lat, t.lng)
    out.push({ kind: 'transfer', id: t.id, vehicleId: t.toVehicleId, ref: t,
      start: at, end: at, startPos: p, endPos: p })
  }
  for (const u of data.unloads) {
    if (u.driverId !== driverId || !u.at) continue
    const at = ms(u.at), p = pos(u.lat, u.lng)
    out.push({ kind: 'unload', id: u.id, vehicleId: u.vehicleId, ref: u,
      start: at, end: at, startPos: p, endPos: p })
  }
  return out.sort((a, b) => a.start - b.start)
}
