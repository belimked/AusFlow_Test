<template>
  <div class="addr">
    <el-autocomplete v-model="model" :fetch-suggestions="search" :debounce="350" :trigger-on-focus="false" value-key="address1"
      :placeholder="placeholder" clearable fit-input-width style="width: 100%" @select="(s) => emit('select', s)">
      <template #default="{ item }">
        <div class="opt">
          <div><el-icon><Location /></el-icon> {{ item.label }}</div>
          <div v-if="item.place" class="muted place">{{ item.place }}</div>
        </div>
      </template>
    </el-autocomplete>
    <div class="credit muted">Address search: Photon · © OpenStreetMap contributors</div>
  </div>
</template>
<script setup>
const model = defineModel({ type: String })
const props = defineProps({ placeholder: String, near: Object })
const emit = defineEmits(['select'])

const AU_BBOX = '112.9,-43.7,153.7,-10.6'
const STATE_ABBR = {
  Queensland: 'QLD', 'New South Wales': 'NSW', Victoria: 'VIC', 'South Australia': 'SA', 'Western Australia': 'WA',
  Tasmania: 'TAS', 'Northern Territory': 'NT', 'Australian Capital Territory': 'ACT'
}
// OSM stores full street types, so expand the abbreviations people usually type.
const STREET_TYPES = {
  rd: 'Road', st: 'Street', ave: 'Avenue', av: 'Avenue', dr: 'Drive', ct: 'Court', pl: 'Place', hwy: 'Highway', cres: 'Crescent',
  cr: 'Crescent', tce: 'Terrace', pde: 'Parade', ln: 'Lane', bvd: 'Boulevard', blvd: 'Boulevard', cct: 'Circuit', cl: 'Close', esp: 'Esplanade'
}
// Only expand when the previous token is a word, so "12 St Kilda Rd" keeps "St" but expands "Rd".
const expand = (q) => q.split(/\s+/).map((w, i, all) => {
  const full = STREET_TYPES[w.replace(/[.,]$/, '').toLowerCase()]
  return full && i > 0 && /^[A-Za-z]/.test(all[i - 1]) ? full + (w.endsWith(',') ? ',' : '') : w
}).join(' ')

let seq = 0
async function search(query, cb) {
  const q = (query || '').trim()
  if (q.length < 3) return cb([])
  const mine = ++seq
  const near = props.near?.lat != null ? props.near : { lat: -27.47, lng: 153.03 }
  const params = new URLSearchParams({ q: expand(q), limit: '8', lang: 'en', bbox: AU_BBOX, lat: near.lat, lon: near.lng })
  try {
    const res = await fetch('https://photon.komoot.io/api/?' + params)
    const { features = [] } = await res.json()
    if (mine !== seq) return
    const seen = new Set()
    const out = []
    for (const f of features) {
      const p = f.properties
      if (p.countrycode !== 'AU' || !(p.street || p.name)) continue
      const address1 = p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : p.name
      const suburb = (p.district || p.locality || p.city || '').toUpperCase()
      const state = STATE_ABBR[p.state] || p.state || ''
      const label = [address1, [suburb, state, p.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      const place = p.name && p.street ? p.name : ''
      const key = label + '|' + place
      if (seen.has(key)) continue
      seen.add(key)
      const [lng, lat] = f.geometry.coordinates
      out.push({ address1, suburb, state, postcode: p.postcode || '', lat, lng, label, place })
    }
    cb(out)
  } catch {
    if (mine === seq) cb([])
  }
}
</script>
<style scoped>
.addr { width: 100%; }
.opt { line-height: 1.35; padding: 4px 0; white-space: normal; }
.opt .place { font-size: 12px; padding-left: 18px; }
.credit { font-size: 11px; line-height: 1.4; margin-top: 2px; }
</style>
