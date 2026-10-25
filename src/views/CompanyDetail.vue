<template>
  <div class="page" v-if="co">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      {{ co.name }}
      <el-tag :type="co.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[co.status] }}</el-tag>
      <el-tag v-if="!asTransport" type="warning" effect="plain">{{ COMPANY_TYPES[view] || 'Occupier' }}</el-tag>
      <span style="flex: 1" />
      <el-button v-can="'write'" :icon="'Edit'" @click="dlg = true">Edit</el-button>
    </h2>
    <div class="card">
      <el-tabs v-model="tab">
        <el-tab-pane label="Basic information" name="info">
          <el-descriptions :column="2" border style="max-width: 900px">
            <el-descriptions-item label="Company name">{{ co.name }}</el-descriptions-item>
            <el-descriptions-item label="ABN">{{ co.abn || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Contact">{{ co.contact || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Phone">{{ co.phone || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Address" :span="2">{{ co.address || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Types">{{ companyTypes(co).map((t) => COMPANY_TYPES[t]).join(', ') }}</el-descriptions-item>
            <el-descriptions-item v-if="asTransport" label="Drivers">{{ drivers.length }} ({{ drivers.filter((d) => d.status === 'pending').length }} pending)</el-descriptions-item>
            <el-descriptions-item v-if="asTransport" label="Vehicles">{{ vehicles.length }}</el-descriptions-item>
            <el-descriptions-item v-if="asTransport" label="Devices">{{ devices.length }} (<span class="red">{{ devices.filter(isOverdue).length }}</span> overdue)</el-descriptions-item>
            <el-descriptions-item v-if="asTransport" label="Pump-outs (14 days)">{{ pickups.length }} jobs, {{ fmtL(pickups.reduce((s, p) => s + (p.volume || 0), 0)) }}</el-descriptions-item>
            <el-descriptions-item v-if="!asTransport" label="Devices owned">{{ ownedDevices.length }} (<span class="red">{{ ownedDevices.filter(isOverdue).length }}</span> overdue)</el-descriptions-item>
            <el-descriptions-item v-if="!asTransport" label="Locations">{{ ownedLocations.length }}</el-descriptions-item>
            <el-descriptions-item v-if="!asTransport" label="Serviced by">{{ servicedBy.map((c) => c.name).join(', ') || '—' }}</el-descriptions-item>
            <el-descriptions-item v-if="!asTransport" label="Pump-outs (14 days)">{{ ownedPickups.length }} jobs, {{ fmtL(ownedPickups.reduce((s, p) => s + (p.volume || 0), 0)) }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        <el-tab-pane :label="photoCount == null ? 'Photos' : `Photos (${photoCount})`" name="photos">
          <EntityPhotos type="company" :id="id" @count="(n) => (photoCount = n)" />
        </el-tab-pane>
        <el-tab-pane v-if="asTransport" :label="`Drivers (${drivers.length})`" name="drivers">
          <div v-can="'write'" style="text-align: right; margin-bottom: 10px"><el-button type="primary" @click="driverDlg = true">Add driver</el-button></div>
          <el-table :data="drivers" size="small" stripe>
            <el-table-column label="Name"><template #default="{ row }"><span class="link" @click="router.push('/drivers/' + row.id)">{{ row.name }}</span></template></el-table-column>
            <el-table-column prop="phone" label="Phone" />
            <el-table-column prop="account" label="Username" />
            <el-table-column label="Status"><template #default="{ row }"><el-tag size="small" :type="DRIVER_TAG[row.status]">{{ DRIVER_STATUS[row.status] }}</el-tag></template></el-table-column>
          </el-table>
          <el-button link type="primary" style="margin-top: 8px" @click="router.push({ path: '/drivers', query: { company: co.id } })">Go to drivers →</el-button>
        </el-tab-pane>
        <el-tab-pane v-if="asTransport" :label="`Vehicles (${vehicles.length})`" name="vehicles">
          <div v-can="'write'" style="text-align: right; margin-bottom: 10px"><el-button type="primary" @click="vehicleDlg = true">Add vehicle</el-button></div>
          <el-table :data="vehicles" size="small" stripe>
            <el-table-column label="Plate"><template #default="{ row }"><span class="link" @click="router.push('/vehicles/' + row.id)">{{ row.plate }}</span></template></el-table-column>
            <el-table-column label="Truck type"><template #default="{ row }">{{ VEHICLE_TYPE[row.type] }}</template></el-table-column>
            <el-table-column label="Tank capacity"><template #default="{ row }">{{ fmtL(row.tank) }}</template></el-table-column>
            <el-table-column label="Current load"><template #default="{ row }">{{ fmtL(vehicleLoads.get(row.id) || 0) }}</template></el-table-column>
            <el-table-column label="Status"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[row.status] }}</el-tag></template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane v-if="asTransport" :label="`Devices (${devices.length})`" name="devices">
          <DeviceTable :rows="devices" hide-company />
        </el-tab-pane>
        <el-tab-pane v-if="!asTransport" :label="`Devices owned (${ownedDevices.length})`" name="owned-devices">
          <DeviceTable :rows="ownedDevices" size="default" />
        </el-tab-pane>
        <el-tab-pane v-if="!asTransport" :label="`Locations (${ownedLocations.length})`" name="locations">
          <el-table :data="ownedLocations" stripe>
            <el-table-column label="Location"><template #default="{ row }"><span class="link" @click="router.push('/locations/' + row.id)">{{ row.name }}</span></template></el-table-column>
            <el-table-column label="Address" show-overflow-tooltip><template #default="{ row }">{{ [row.address1, row.suburb, row.state, row.postcode].filter(Boolean).join(', ') }}</template></el-table-column>
            <el-table-column label="Relationship" width="200"><template #default="{ row }">{{ relation(row) }}</template></el-table-column>
            <el-table-column label="Devices" width="90" align="right"><template #default="{ row }">{{ ownedDevices.filter((d) => d.locationId === row.id).length }}</template></el-table-column>
            <el-table-column label="Overdue" width="90" align="right"><template #default="{ row }"><span class="red">{{ ownedDevices.filter((d) => d.locationId === row.id && isOverdue(d)).length || '' }}</span></template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane v-if="!asTransport" :label="`Pump-outs (${ownedPickups.length})`" name="owned-ops">
          <PickupTable :rows="ownedPickups" />
        </el-tab-pane>
        <el-tab-pane v-if="asTransport" label="Consignments" name="ops">
          <el-radio-group v-model="opsTab" style="margin-bottom: 10px">
            <el-radio-button value="p">Pump-outs ({{ pickups.length }})</el-radio-button>
            <el-radio-button value="t">Transfers ({{ transfers.length }})</el-radio-button>
            <el-radio-button value="u">Unloads ({{ unloads.length }})</el-radio-button>
          </el-radio-group>
          <div class="toolbar" style="margin-bottom: 10px">
            <el-input v-model="opFilter.q" placeholder="Search device, location, driver, vehicle" clearable :prefix-icon="'Search'" style="width: 300px" />
            <el-select v-if="statusOptions.length" v-model="opFilter.status" placeholder="Status" clearable style="width: 150px"><el-option v-for="s in statusOptions" :key="s" :label="STATUS_LABEL[s] || s" :value="s" /></el-select>
            <el-date-picker v-model="opFilter.dates" type="daterange" range-separator="to" start-placeholder="From" end-placeholder="To" style="width: 260px" />
          </div>
          <PickupTable v-if="opsTab === 'p'" :rows="filteredOps" hide-company />
          <TransferTable v-if="opsTab === 't'" :rows="filteredOps" hide-company />
          <UnloadTable v-if="opsTab === 'u'" :rows="filteredOps" hide-company />
        </el-tab-pane>
      </el-tabs>
    </div>
    <EntityDialog v-model="dlg" title="Edit company" :fields="companyFields(co)" :record="co" @submit="(d) => upsert('companies', co, d)" />
    <EntityDialog v-model="driverDlg" title="Add driver" :fields="driverFields(null).map(lockTransport)"
      :defaults="{ ...DEFAULTS.drivers, companyId: co.id }" @submit="(d) => upsert('drivers', null, d)" />
    <EntityDialog v-model="vehicleDlg" title="Add vehicle" :fields="vehicleFields(null).map(lockTransport)"
      :defaults="{ ...DEFAULTS.vehicles, companyId: co.id, qr: vehicleQr }" @submit="(d) => upsert('vehicles', null, d)" />
  </div>
  <el-empty v-else description="Company not found" />
</template>
<script setup>
import { ref, computed, watch, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EntityDialog from '../components/EntityDialog.vue'
import EntityPhotos from '../components/EntityPhotos.vue'
import DeviceTable from '../components/DeviceTable.vue'
import PickupTable from '../components/PickupTable.vue'
import TransferTable from '../components/TransferTable.vue'
import UnloadTable from '../components/UnloadTable.vue'
import { state, idx, isTransport, companyTypes, COMPANY_TYPES, isOverdue, vehicleLoads, fmtL, nameOf, plateOf, ENTITY_STATUS, DRIVER_STATUS, VEHICLE_TYPE } from '../store/db'
import { companyFields, driverFields, vehicleFields, DEFAULTS, upsert } from '../store/forms'

const DRIVER_TAG = { pending: 'warning', active: 'success', inactive: 'info' }
const route = useRoute(), router = useRouter()
const id = route.params.id
const tab = ref('info'), opsTab = ref('p'), dlg = ref(false), driverDlg = ref(false), vehicleDlg = ref(false), photoCount = ref(null)
const lockTransport = (f) => f.key === 'companyId' ? { ...f, disabled: true } : f
const code = () => Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
const vehicleQr = ref('')
// Generate a fresh default each time the dialog is opened.
watch(vehicleDlg, (open) => { if (open) vehicleQr.value = 'VH' + code() }, { flush: 'sync' })
const co = computed(() => idx.companies.value.get(id))
// Which face of the company this page shows: the list / link that opened it says (?type=occupier), otherwise the
// company's own types decide. Occupiers and owners are the companies devices belong to (device.ownerId).
const view = computed(() => route.query.type || (isTransport(co.value) ? 'transport' : companyTypes(co.value)[0] || 'occupier'))
const asTransport = computed(() => view.value === 'transport')
const ownedDevices = computed(() => state.devices.filter((d) => d.ownerId === id))
const ownedLocations = computed(() => {
  const ids = new Set(ownedDevices.value.map((d) => d.locationId).filter(Boolean))
  for (const l of state.locations) if (l.ownerId === id || l.occupierId === id) ids.add(l.id)
  return state.locations.filter((l) => ids.has(l.id))
})
const relation = (l) => [l.occupierId === id ? 'Occupier' : null, l.ownerId === id ? 'Owner' : null, ownedDevices.value.some((d) => d.locationId === l.id) ? 'Device owner' : null].filter(Boolean).join(' · ')
const servicedBy = computed(() => [...new Set(ownedDevices.value.map((d) => d.companyId).filter(Boolean))].map((c) => idx.companies.value.get(c)).filter(Boolean))
const ownedPickups = computed(() => {
  const ids = new Set(ownedDevices.value.map((d) => d.id))
  const from = Date.now() - 14 * 864e5
  return state.pickups.filter((p) => ids.has(p.deviceId) && new Date(p.endAt || p.startAt).getTime() >= from)
})
const of = (key) => computed(() => state[key].filter((x) => x.companyId === id))
const drivers = of('drivers'), vehicles = of('vehicles'), devices = of('devices'), pickups = of('pickups'), transfers = of('transfers'), unloads = of('unloads')

const STATUS_LABEL = { ongoing: 'In progress', done: 'Done' }
const opFilter = reactive({ q: '', status: '', dates: null })
watch(opsTab, () => { opFilter.q = ''; opFilter.status = ''; opFilter.dates = null })
const opDate = { p: (r) => r.endAt || r.startAt, t: (r) => r.at, u: (r) => r.at }
const opText = {
  p: (r) => [r.deviceId, idx.devices.value.get(r.deviceId)?.aka, nameOf('locations', r.locationId), nameOf('drivers', r.driverId), plateOf(r.vehicleId)],
  t: (r) => [nameOf('drivers', r.driverId), plateOf(r.fromVehicleId), plateOf(r.toVehicleId)],
  u: (r) => [nameOf('drivers', r.driverId), plateOf(r.vehicleId), nameOf('facilities', r.facilityId)]
}
const curList = computed(() => ({ p: pickups, t: transfers, u: unloads }[opsTab.value].value))
const statusOptions = computed(() => [...new Set(curList.value.map((r) => r.status).filter(Boolean))])
const filteredOps = computed(() => {
  const k = opFilter.q.trim().toLowerCase()
  const range = opFilter.dates
  return curList.value.filter((r) => {
    if (k && !opText[opsTab.value](r).some((x) => x && String(x).toLowerCase().includes(k))) return false
    if (opFilter.status && r.status !== opFilter.status) return false
    if (range) {
      const d = opDate[opsTab.value](r)
      if (!d) return false
      const t = new Date(d).getTime()
      if (t < range[0].getTime() || t > range[1].getTime() + 864e5 - 1) return false
    }
    return true
  })
})
</script>
