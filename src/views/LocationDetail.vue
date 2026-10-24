<template>
  <div class="page" v-if="loc">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      {{ loc.name }}
      <el-tag :type="loc.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[loc.status] }}</el-tag>
      <span style="flex: 1" />
      <el-button v-can="'write'" :icon="'Edit'" @click="dlg = true">Edit</el-button>
      <el-button v-can="'write'" type="primary" :icon="'Plus'" @click="deviceDlg = true">Add device here</el-button>
    </h2>
    <el-row :gutter="12">
      <el-col :span="12">
        <div class="card">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="Location ID">{{ loc.id }}</el-descriptions-item>
            <el-descriptions-item label="Custodian">{{ CUSTODIAN[loc.custodianCategory] || '(Unspecified)' }}</el-descriptions-item>
            <el-descriptions-item label="Owner"><span v-if="loc.ownerId" class="link" @click="router.push({ path: '/companies/' + loc.ownerId, query: { type: 'owner' } })">{{ nameOf('companies', loc.ownerId) }}</span><span v-else>—</span></el-descriptions-item>
            <el-descriptions-item label="Occupier"><span v-if="loc.occupierId" class="link" @click="router.push({ path: '/companies/' + loc.occupierId, query: { type: 'occupier' } })">{{ nameOf('companies', loc.occupierId) }}</span><span v-else>—</span></el-descriptions-item>
            <el-descriptions-item label="Agreement No.">{{ loc.agreementNo || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Address">{{ [loc.address1, loc.address2].filter(Boolean).join(', ') }}</el-descriptions-item>
            <el-descriptions-item label="Suburb">{{ loc.suburb }} {{ loc.state }} {{ loc.postcode }}</el-descriptions-item>
            <el-descriptions-item label="Coordinates">{{ loc.lat != null ? `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}` : 'Not set' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card"><MapView :markers="markers" :height="230" /></div>
      </el-col>
    </el-row>
    <div class="card">
      <h3 style="margin: 0 0 10px">Devices at this location ({{ devices.length }})</h3>
      <DeviceTable :rows="devices" hide-location />
    </div>
    <LocationDialog v-model="dlg" :record="loc" />
    <DeviceDialog v-model="deviceDlg" :defaults="{ locationId: loc.id }" />
  </div>
  <el-empty v-else description="Location not found" />
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import LocationDialog from '../components/LocationDialog.vue'
import DeviceDialog from '../components/DeviceDialog.vue'
import DeviceTable from '../components/DeviceTable.vue'
import { state, idx, nameOf, ENTITY_STATUS, CUSTODIAN } from '../store/db'

const route = useRoute(), router = useRouter()
const loc = computed(() => idx.locations.value.get(route.params.id))
const devices = computed(() => state.devices.filter((d) => d.locationId === route.params.id))
const markers = computed(() => [
  ...(loc.value?.lat != null ? [{ lat: loc.value.lat, lng: loc.value.lng, label: loc.value.name, color: '#e6a23c' }] : []),
  ...devices.value.filter((d) => d.lat != null).map((d) => ({ lat: d.lat, lng: d.lng, label: d.ref + ' ' + (d.aka || ''), color: '#409eff' }))
])
const dlg = ref(false), deviceDlg = ref(false)
</script>
