// Road routing between job steps, for the driver history page.
// Uses the public OSRM demo server (no key; fair-use rate limit), so legs are requested one at a time and cached.
const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const cache = new Map()
const key = (a, b) => [a.lat, a.lng, b.lat, b.lng].map((v) => v.toFixed(5)).join(',')

// Returns { durationS, distanceM, geometry: [[lat, lng], ...] } or null when the service cannot route the leg.
export async function routeLeg(from, to) {
  if (from?.lat == null || to?.lat == null) return null
  const k = key(from, to)
  if (cache.has(k)) return cache.get(k)
  const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
  const promise = fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json()
    const r = data.routes?.[0]
    if (!r) throw new Error(data.message || 'no route')
    return { durationS: Math.round(r.duration), distanceM: Math.round(r.distance), geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]) }
  }).catch(() => null)
  cache.set(k, promise)
  const result = await promise
  if (!result) cache.delete(k)
  return result
}

// Routes every consecutive pair of steps that has coordinates; sequential to stay inside the demo server's limits.
export async function routeSteps(steps, onLeg) {
  for (let i = 0; i < steps.length - 1; i++) {
    const leg = await routeLeg(steps[i].endPos, steps[i + 1].startPos)
    onLeg(i, leg)
  }
}
