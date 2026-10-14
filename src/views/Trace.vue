<template>
  <div class="page">
    <div class="card">
      <el-radio-group v-model="mode" style="margin-bottom: 14px">
        <el-radio-button value="forward">Pump-out → destination</el-radio-button>
        <el-radio-button value="backward">Unload → source devices</el-radio-button>
      </el-radio-group>

      <template v-if="mode === 'forward'">
        <div class="toolbar">
          <el-select-v2 v-model="pickupId" :options="pickupOptions" filterable clearable placeholder="Select pump-out ID, Device Ref or location" style="width: 520px" />
        </div>
        <el-row v-if="pickup" :gutter="16">
          <el-col :span="10">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="Pump-out ID"><span class="link" @click="router.push('/pickups/' + pickup.id)">{{ pickup.id }}</span></el-descriptions-item>
              <el-descriptions-item label="Device"><span class="link" @click="router.push('/devices/' + pickup.deviceId)">{{ pickup.deviceId }}</span> · {{ nameOf('locations', pickup.locationId) }}</el-descriptions-item>
              <el-descriptions-item label="Volume">{{ fmtL(pickup.volume) }}</el-descriptions-item>
              <el-descriptions-item label="Time">{{ fmtTime(pickup.endAt) }}</el-descriptions-item>
            </el-descriptions>
            <div style="margin-top: 16px"><TraceSteps :pickup="pickup" /></div>
          </el-col>
          <el-col :span="14"><MapView :markers="fwdMarkers" :lines="fwdLines" :height="380" /></el-col>
        </el-row>
        <el-empty v-else description="Select a completed pump-out" />
      </template>

      <template v-else>
        <div class="toolbar">
          <el-select-v2 v-model="unloadId" :options="unloadOptions" filterable clearable placeholder="Select unload ID, plate or facility" style="width: 520px" />
        </div>
        <template v-if="unload">
          <el-alert type="success" :closable="false" style="margin-bottom: 12px"
            :title="`Unload ${unload.id}: ${plateOf(unload.vehicleId)} unloaded ${fmtL(unload.volume)} at ${nameOf('facilities', unload.facilityId)} on ${fmtTime(unload.at)}`"
            :description="`Sources: ${sources.length} pump-outs from ${new Set(sources.map((s) => s.pickup.deviceId)).size} devices, total ${fmtL(sources.reduce((s, x) => s + x.pickup.volume, 0))}`" />
          <el-row :gutter="16">
            <el-col :span="10">
              <h4 style="margin: 0 0 8px">Flow tree</h4>
              <el-tree :data="treeData" default-expand-all :expand-on-click-node="false">
                <template #default="{ data }">
                  <span :class="{ link: data.to }" @click="data.to && router.push(data.to)">
                    <el-icon style="vertical-align: -2px"><component :is="data.icon" /></el-icon> {{ data.label }}
                  </span>
                </template>
              </el-tree>
            </el-col>
            <el-col :span="14"><MapView :markers="bwdMarkers" :lines="bwdLines" :height="380" /></el-col>
          </el-row>
          <h4>Source devices</h4>
          <el-table :data="sources" size="small" stripe>
            <el-table-column label="Pump-out ID" width="120"><template #default="{ row }"><span class="link" @click="router.push('/pickups/' + row.pickup.id)">{{ row.pickup.id }}</span></template></el-table-column>
            <el-table-column label="Device" width="100"><template #default="{ row }"><span class="link" @click="router.push('/devices/' + row.pickup.deviceId)">{{ row.pickup.deviceId }}</span></template></el-table-column>
            <el-table-column label="Location" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ nameOf('locations', row.pickup.locationId) }}</template></el-table-column>
            <el-table-column label="Volume" width="110" align="right"><template #default="{ row }">{{ fmtL(row.pickup.volume) }}</template></el-table-column>
            <el-table-column label="Pump-out time" width="160"><template #default="{ row }">{{ fmtTime(row.pickup.endAt) }}</template></el-table-column>
            <el-table-column label="Vehicles" min-width="160"><template #default="{ row }">{{ row.path.map(plateOf).join(' → ') }}</template></el-table-column>
          </el-table>
        </template>
        <el-empty v-else description="Select an unload" />
      </template>
      <p class="muted" style="font-size: 12px; margin-top: 16px">Prototype rule: a transfer moves the whole load and an unload empties the vehicle; production can track partial transfers.</p>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import TraceSteps from '../components/TraceSteps.vue'
import { state, idx, nameOf, plateOf, traceForward, traceBackward, fmtTime, fmtL } from '../store/db'

const route = useRoute(), router = useRouter()
const mode = ref(route.query.unload ? 'backward' : 'forward')
const pickupId = ref(route.query.pickup || '')
const unloadId = ref(route.query.unload || '')

const pickupOptions = computed(() => state.pickups.filter((p) => p.status === 'done').map((p) => ({
  value: p.id, label: `${p.id} · ${p.deviceId} · ${nameOf('locations', p.locationId)} · ${fmtTime(p.endAt)}`
})))
const unloadOptions = computed(() => state.unloads.map((u) => ({
  value: u.id, label: `${u.id} · ${plateOf(u.vehicleId)} · ${nameOf('facilities', u.facilityId)} · ${fmtTime(u.at)} · ${fmtL(u.volume)}`
})))

const pickup = computed(() => idx.pickups.value.get(pickupId.value))
const unload = computed(() => state.unloads.find((u) => u.id === unloadId.value))
const dev = (id) => idx.devices.value.get(id)
const fac = (id) => idx.facilities.value.get(id)

const fwdPoints = computed(() => {
  if (!pickup.value) return []
  const d = dev(pickup.value.deviceId)
  const pts = [{ lat: pickup.value.endLat ?? d?.lat, lng: pickup.value.endLng ?? d?.lng, label: 'Pump-out: ' + pickup.value.deviceId, color: '#e6a23c', permanent: true }]
  for (const h of traceForward(pickup.value).hops.slice(1)) {
    if (h.kind === 'transfer') pts.push({ lat: h.ref.lat, lng: h.ref.lng, label: 'Transfer → ' + plateOf(h.vehicleId), color: '#409eff', permanent: true })
    else { const f = fac(h.ref.facilityId); pts.push({ lat: f.lat, lng: f.lng, label: f.name, color: '#67c23a', permanent: true }) }
  }
  return pts.filter((p) => p.lat != null)
})
const fwdMarkers = fwdPoints
const fwdLines = computed(() => fwdPoints.value.slice(1).map((p, i) => [[fwdPoints.value[i].lat, fwdPoints.value[i].lng], [p.lat, p.lng]]))

const tree = computed(() => (unload.value ? traceBackward(unload.value.vehicleId, new Date(unload.value.at).getTime()) : null))
const sources = computed(() => {
  const out = []
  const walk = (node, downstream) => {
    const chain = [node.vehicleId, ...downstream]
    for (const p of node.pickups) out.push({ pickup: p, path: chain })
    for (const t of node.transfersIn) walk(t.source, chain)
  }
  if (tree.value) walk(tree.value, [])
  return out
})
const treeData = computed(() => {
  if (!tree.value) return []
  const build = (node) => [
    ...node.pickups.map((p) => ({ label: `Pump-out ${p.id} · ${p.deviceId} ${nameOf('locations', p.locationId)} · ${fmtL(p.volume)}`, icon: 'Box', to: '/devices/' + p.deviceId })),
    ...node.transfersIn.map((t) => ({
      label: `Transferred in from ${plateOf(t.transfer.fromVehicleId)} · ${fmtTime(t.transfer.at)} · ${fmtL(t.transfer.volume)}`, icon: 'Van', to: '/vehicles/' + t.transfer.fromVehicleId,
      children: build(t.source)
    }))
  ]
  return [{
    label: `${nameOf('facilities', unload.value.facilityId)} ← Vehicle ${plateOf(unload.value.vehicleId)}`, icon: 'OfficeBuilding',
    to: '/facilities/' + unload.value.facilityId, children: build(tree.value)
  }]
})
const bwdMarkers = computed(() => {
  if (!unload.value) return []
  const f = fac(unload.value.facilityId)
  return [
    { lat: f.lat, lng: f.lng, label: f.name, color: '#67c23a', permanent: true },
    ...sources.value.map((s) => { const d = dev(s.pickup.deviceId); return { lat: s.pickup.endLat ?? d?.lat, lng: s.pickup.endLng ?? d?.lng, label: `${s.pickup.deviceId} · ${fmtL(s.pickup.volume)}`, color: '#e6a23c' } })
  ].filter((m) => m.lat != null)
})
const bwdLines = computed(() => bwdMarkers.value.slice(1).map((m) => [[m.lat, m.lng], [bwdMarkers.value[0].lat, bwdMarkers.value[0].lng]]))
</script>
