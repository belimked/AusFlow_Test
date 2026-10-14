<template>
  <div class="page" v-if="v">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      <span class="mono">{{ v.plate }}</span>
      <el-tag>{{ VEHICLE_TYPE[v.type] }}</el-tag>
      <el-tag :type="v.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[v.status] }}</el-tag>
      <span style="flex: 1" />
      <el-button :icon="'Edit'" @click="dlg = true">Edit</el-button>
    </h2>
    <el-row :gutter="12">
      <el-col :span="16">
        <div class="card">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="Plate">{{ v.plate }}</el-descriptions-item>
            <el-descriptions-item label="Hauler"><span class="link" @click="router.push('/companies/' + v.companyId)">{{ nameOf('companies', v.companyId) }}</span></el-descriptions-item>
            <el-descriptions-item label="Truck type">{{ VEHICLE_TYPE[v.type] }}</el-descriptions-item>
            <el-descriptions-item label="Tank capacity">{{ fmtL(v.tank) }}</el-descriptions-item>
          </el-descriptions>
          <div style="margin-top: 16px">
            <div class="muted" style="margin-bottom: 6px">Current load: <b style="color: #1f2d3d">{{ fmtL(load) }}</b> / {{ fmtL(v.tank) }}</div>
            <el-progress :percentage="Math.min(100, Math.round((load / v.tank) * 100))" :stroke-width="18" text-inside />
            <div class="muted" style="margin-top: 6px; font-size: 12px">Load = pump-outs + transfers in − transfers out − unloads (reset to 0 after unloading)</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8"><div class="card" style="text-align: center"><QrCode :value="v.qr" :title="'Vehicle ' + v.plate" :subtitle="nameOf('companies', v.companyId)"
        editable prefix="VH" :validate="(c) => state.vehicles.some((x) => x.id !== v.id && x.qr === c) ? 'Already used by another vehicle' : ''" @change="(qr) => upsert('vehicles', v, { qr })" /></div></el-col>
    </el-row>
    <div class="card">
      <el-tabs v-model="tab">
        <el-tab-pane :label="`Pump-outs (${pickups.length})`" name="p"><PickupTable :rows="pickups" hide-company hide-vehicle /></el-tab-pane>
        <el-tab-pane :label="`Transfers in / out (${transfers.length})`" name="t"><TransferTable :rows="transfers" hide-company /></el-tab-pane>
        <el-tab-pane :label="`Unloads (${unloads.length})`" name="u"><UnloadTable :rows="unloads" hide-company /></el-tab-pane>
        <el-tab-pane :label="photoCount == null ? 'Photos' : `Photos (${photoCount})`" name="photos">
          <EntityPhotos type="vehicle" :id="id" @count="(n) => (photoCount = n)" />
        </el-tab-pane>
      </el-tabs>
    </div>
    <EntityDialog v-model="dlg" title="Edit vehicle" :fields="vehicleFields(v)" :record="v" @submit="(d) => upsert('vehicles', v, d)" />
  </div>
  <el-empty v-else description="Vehicle not found" />
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QrCode from '../components/QrCode.vue'
import EntityDialog from '../components/EntityDialog.vue'
import EntityPhotos from '../components/EntityPhotos.vue'
import PickupTable from '../components/PickupTable.vue'
import TransferTable from '../components/TransferTable.vue'
import UnloadTable from '../components/UnloadTable.vue'
import { state, idx, nameOf, vehicleLoads, fmtL, ENTITY_STATUS, VEHICLE_TYPE } from '../store/db'
import { vehicleFields, upsert } from '../store/forms'

const route = useRoute(), router = useRouter()
const id = route.params.id
const tab = ref('p'), dlg = ref(false), photoCount = ref(null)
const v = computed(() => idx.vehicles.value.get(id))
const load = computed(() => vehicleLoads.value.get(id) || 0)
const pickups = computed(() => state.pickups.filter((p) => p.vehicleId === id))
const transfers = computed(() => state.transfers.filter((t) => t.fromVehicleId === id || t.toVehicleId === id))
const unloads = computed(() => state.unloads.filter((u) => u.vehicleId === id))
</script>
