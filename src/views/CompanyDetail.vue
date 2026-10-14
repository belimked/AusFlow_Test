<template>
  <div class="page" v-if="co">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      {{ co.name }}
      <el-tag :type="co.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[co.status] }}</el-tag>
      <span style="flex: 1" />
      <el-button :icon="'Edit'" @click="dlg = true">Edit</el-button>
    </h2>
    <div class="card">
      <el-tabs v-model="tab">
        <el-tab-pane label="Basic information" name="info">
          <el-descriptions :column="2" border style="max-width: 900px">
            <el-descriptions-item label="Hauler name">{{ co.name }}</el-descriptions-item>
            <el-descriptions-item label="ABN">{{ co.abn || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Contact">{{ co.contact || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Phone">{{ co.phone || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Address" :span="2">{{ co.address || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Drivers">{{ drivers.length }} ({{ drivers.filter((d) => d.status === 'pending').length }} pending)</el-descriptions-item>
            <el-descriptions-item label="Vehicles">{{ vehicles.length }}</el-descriptions-item>
            <el-descriptions-item label="Devices">{{ devices.length }} (<span class="red">{{ devices.filter(isOverdue).length }}</span> overdue)</el-descriptions-item>
            <el-descriptions-item label="Pump-outs (14 days)">{{ pickups.length }} jobs, {{ fmtL(pickups.reduce((s, p) => s + (p.volume || 0), 0)) }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        <el-tab-pane :label="photoCount == null ? 'Photos' : `Photos (${photoCount})`" name="photos">
          <EntityPhotos type="company" :id="id" @count="(n) => (photoCount = n)" />
        </el-tab-pane>
        <el-tab-pane :label="`Drivers (${drivers.length})`" name="drivers">
          <div style="text-align: right; margin-bottom: 10px"><el-button type="primary" @click="driverDlg = true">Add driver</el-button></div>
          <el-table :data="drivers" size="small" stripe>
            <el-table-column prop="name" label="Name" />
            <el-table-column prop="phone" label="Phone" />
            <el-table-column prop="account" label="Username" />
            <el-table-column label="Status"><template #default="{ row }"><el-tag size="small" :type="DRIVER_TAG[row.status]">{{ DRIVER_STATUS[row.status] }}</el-tag></template></el-table-column>
          </el-table>
          <el-button link type="primary" style="margin-top: 8px" @click="router.push({ path: '/drivers', query: { company: co.id } })">Go to drivers →</el-button>
        </el-tab-pane>
        <el-tab-pane :label="`Vehicles (${vehicles.length})`" name="vehicles">
          <div style="text-align: right; margin-bottom: 10px"><el-button type="primary" @click="vehicleDlg = true">Add vehicle</el-button></div>
          <el-table :data="vehicles" size="small" stripe>
            <el-table-column label="Plate"><template #default="{ row }"><span class="link" @click="router.push('/vehicles/' + row.id)">{{ row.plate }}</span></template></el-table-column>
            <el-table-column label="Truck type"><template #default="{ row }">{{ VEHICLE_TYPE[row.type] }}</template></el-table-column>
            <el-table-column label="Tank capacity"><template #default="{ row }">{{ fmtL(row.tank) }}</template></el-table-column>
            <el-table-column label="Current load"><template #default="{ row }">{{ fmtL(vehicleLoads.get(row.id) || 0) }}</template></el-table-column>
            <el-table-column label="Status"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[row.status] }}</el-tag></template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="`Devices (${devices.length})`" name="devices">
          <DeviceTable :rows="devices" hide-company />
        </el-tab-pane>
        <el-tab-pane label="Operations" name="ops">
          <el-radio-group v-model="opsTab" style="margin-bottom: 10px">
            <el-radio-button value="p">Pump-outs ({{ pickups.length }})</el-radio-button>
            <el-radio-button value="t">Transfers ({{ transfers.length }})</el-radio-button>
            <el-radio-button value="u">Unloads ({{ unloads.length }})</el-radio-button>
          </el-radio-group>
          <PickupTable v-if="opsTab === 'p'" :rows="pickups" hide-company />
          <TransferTable v-if="opsTab === 't'" :rows="transfers" hide-company />
          <UnloadTable v-if="opsTab === 'u'" :rows="unloads" hide-company />
        </el-tab-pane>
      </el-tabs>
    </div>
    <EntityDialog v-model="dlg" title="Edit hauler" :fields="companyFields(co)" :record="co" @submit="(d) => upsert('companies', co, d)" />
    <EntityDialog v-model="driverDlg" title="Add driver" :fields="driverFields(null).map(lockHauler)"
      :defaults="{ ...DEFAULTS.drivers, companyId: co.id }" @submit="(d) => upsert('drivers', null, d)" />
    <EntityDialog v-model="vehicleDlg" title="Add vehicle" :fields="vehicleFields(null).map(lockHauler)"
      :defaults="{ ...DEFAULTS.vehicles, companyId: co.id, qr: vehicleQr }" @submit="(d) => upsert('vehicles', null, d)" />
  </div>
  <el-empty v-else description="Hauler not found" />
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EntityDialog from '../components/EntityDialog.vue'
import EntityPhotos from '../components/EntityPhotos.vue'
import DeviceTable from '../components/DeviceTable.vue'
import PickupTable from '../components/PickupTable.vue'
import TransferTable from '../components/TransferTable.vue'
import UnloadTable from '../components/UnloadTable.vue'
import { state, idx, isOverdue, vehicleLoads, fmtL, ENTITY_STATUS, DRIVER_STATUS, VEHICLE_TYPE } from '../store/db'
import { companyFields, driverFields, vehicleFields, DEFAULTS, upsert } from '../store/forms'

const DRIVER_TAG = { pending: 'warning', active: 'success', inactive: 'info' }
const route = useRoute(), router = useRouter()
const id = route.params.id
const tab = ref('info'), opsTab = ref('p'), dlg = ref(false), driverDlg = ref(false), vehicleDlg = ref(false), photoCount = ref(null)
const lockHauler = (f) => f.key === 'companyId' ? { ...f, disabled: true } : f
const code = () => Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
const vehicleQr = ref('')
// Generate a fresh default each time the dialog is opened.
watch(vehicleDlg, (open) => { if (open) vehicleQr.value = 'VH' + code() }, { flush: 'sync' })
const co = computed(() => idx.companies.value.get(id))
const of = (key) => computed(() => state[key].filter((x) => x.companyId === id))
const drivers = of('drivers'), vehicles = of('vehicles'), devices = of('devices'), pickups = of('pickups'), transfers = of('transfers'), unloads = of('unloads')
</script>
