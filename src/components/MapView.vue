<template>
  <div ref="el" class="map" :style="{ height: height + 'px' }"></div>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'

// markers: [{ lat, lng, label, color }], lines: [[[lat,lng],...] | { path, label, color, road }], circle: { lat, lng, radius }
const props = defineProps({
  markers: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  circle: Object,
  height: { type: Number, default: 320 }
})
const PALETTE = ['#e11d48', '#f97316', '#0891b2', '#c026d3', '#ca8a04', '#0d9488', '#4f46e5', '#65a30d', '#db2777', '#0284c7', '#7c3aed', '#b45309', '#059669', '#be123c']
const el = ref()
let map, layer, ro, timer

function draw() {
  if (!map) return
  layer.clearLayers()
  const pts = []
  if (props.circle?.lat != null) {
    L.circle([props.circle.lat, props.circle.lng], { radius: props.circle.radius, color: '#409eff', weight: 1, fillOpacity: 0.08 }).addTo(layer)
  }
  // Two-point lines are straight links (dashed); longer ones are road routes (solid). Each leg gets its own colour.
  props.lines.forEach((line, i) => {
    const path = Array.isArray(line) ? line : line.path
    const color = line.color || PALETTE[i % PALETTE.length]
    const road = line.road ?? path.length > 2
    const pl = L.polyline(path, road ? { color, weight: 4, opacity: 0.85 } : { color, dashArray: '6 5', weight: 3, opacity: 0.9 }).addTo(layer)
    if (line.label) pl.bindTooltip(line.label, { sticky: true })
  })
  for (const m of props.markers) {
    if (m.lat == null) continue
    pts.push([m.lat, m.lng])
    L.circleMarker([m.lat, m.lng], { radius: 8, color: '#fff', weight: 2, fillColor: m.color || '#409eff', fillOpacity: 1 })
      .bindTooltip(m.label || '', { permanent: !!m.permanent, direction: 'top', offset: [0, -8] }).addTo(layer)
  }
  if (props.circle?.lat != null) map.fitBounds(L.latLng(props.circle.lat, props.circle.lng).toBounds(props.circle.radius * 2.4).extend(L.latLngBounds(pts.length ? pts : [[props.circle.lat, props.circle.lng]])))
  else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 17 })
  else if (pts.length === 1) map.setView(pts[0], 16)
  else map.setView([-27.47, 153.03], 10)
}

onMounted(() => {
  map = L.map(el.value)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map)
  layer = L.layerGroup().addTo(map)
  draw()
  timer = setTimeout(() => map?.invalidateSize(), 100)
  // Maps inside dialogs/collapses mount before they have a size; refit once they get one.
  let lastW = 0
  ro = new ResizeObserver(([e]) => {
    const w = e.contentRect.width
    if (!map || !w || w === lastW) return
    lastW = w
    map.invalidateSize()
    draw()
  })
  ro.observe(el.value)
})
watch(() => [props.markers, props.lines, props.circle], () => map && draw(), { deep: true })
onBeforeUnmount(() => { clearTimeout(timer); ro?.disconnect(); map?.stop(); map?.remove(); map = null })
</script>
