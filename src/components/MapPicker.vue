<template>
  <div>
    <div class="toolbar">
      <el-input-number v-model="lat" :precision="6" :step="0.0001" :controls="false" placeholder="Latitude" style="width: 180px" />
      <el-input-number v-model="lng" :precision="6" :step="0.0001" :controls="false" placeholder="Longitude" style="width: 180px" />
      <span class="muted">Click the map to select a location</span>
    </div>
    <div ref="el" class="map" style="height: 280px"></div>
  </div>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'

const lat = defineModel('lat')
const lng = defineModel('lng')
const el = ref()
let map, marker, timer

function place() {
  if (!map) return
  if (lat.value == null || lng.value == null) return marker?.remove()
  if (!marker) marker = L.circleMarker([lat.value, lng.value], { radius: 9, color: '#fff', weight: 2, fillColor: '#e6a23c', fillOpacity: 1 }).addTo(map)
  else marker.setLatLng([lat.value, lng.value]).addTo(map)
}

onMounted(() => {
  map = L.map(el.value)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map)
  map.setView(lat.value != null ? [lat.value, lng.value] : [-27.47, 153.03], lat.value != null ? 16 : 11)
  place()
  map.on('click', (e) => { lat.value = +e.latlng.lat.toFixed(6); lng.value = +e.latlng.lng.toFixed(6) })
  timer = setTimeout(() => map?.invalidateSize(), 200)
})
watch([lat, lng], place)
onBeforeUnmount(() => { clearTimeout(timer); map?.stop(); map?.remove(); map = null; marker = null })
</script>
