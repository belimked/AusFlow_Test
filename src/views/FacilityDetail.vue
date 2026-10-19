<template>
  <div class="page" v-if="fa">
    <h2 class="page-title">
      <el-button :icon="'Back'" circle size="small" @click="router.back()" />
      {{ fa.name }}
      <el-tag :type="fa.status === 'active' ? 'success' : 'info'">{{ ENTITY_STATUS[fa.status] }}</el-tag>
      <span style="flex: 1" />
      <el-button v-can="'write'" :icon="'Edit'" @click="dlg = true">Edit</el-button>
    </h2>
    <el-row :gutter="12">
      <el-col :span="10">
        <div class="card">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="Name">{{ fa.name }}</el-descriptions-item>
            <el-descriptions-item label="Address">{{ fa.address }}</el-descriptions-item>
            <el-descriptions-item label="Coordinates">{{ fa.lat != null ? `${fa.lat.toFixed(6)}, ${fa.lng.toFixed(6)}` : 'Not set' }}</el-descriptions-item>
            <el-descriptions-item label="Unloads">{{ unloads.length }}</el-descriptions-item>
            <el-descriptions-item label="Total unloaded">{{ fmtL(unloads.reduce((s, u) => s + u.volume, 0)) }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
      <el-col :span="8"><div class="card"><MapView :markers="[{ lat: fa.lat, lng: fa.lng, label: fa.name, color: '#67c23a' }]" :height="220" /></div></el-col>
      <el-col :span="6"><div class="card" style="text-align: center"><QrCode :value="fa.qr" :title="fa.name" subtitle="Facility unload QR" :size="150"
        editable prefix="FA" :validate="(c) => state.facilities.some((x) => x.id !== fa.id && x.qr === c) ? 'Already used by another facility' : ''" @change="(qr) => upsert('facilities', fa, { qr })" /></div></el-col>
    </el-row>
    <div class="card">
      <h3 style="margin: 0 0 10px">Unloads ({{ unloads.length }})</h3>
      <UnloadTable :rows="unloads" hide-facility @view="(r) => (cur = r)" />
    </div>
    <OpDrawer :record="cur" kind="unload" @close="cur = null" />
    <EntityDialog v-model="dlg" title="Edit Treatment Facility" :fields="facilityFields(fa)" :record="fa" @submit="(d) => upsert('facilities', fa, d)" />
  </div>
  <el-empty v-else description="Treatment Facility not found" />
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import QrCode from '../components/QrCode.vue'
import UnloadTable from '../components/UnloadTable.vue'
import OpDrawer from '../components/OpDrawer.vue'
import EntityDialog from '../components/EntityDialog.vue'
import { state, idx, fmtL, ENTITY_STATUS } from '../store/db'
import { facilityFields, upsert } from '../store/forms'

const route = useRoute(), router = useRouter()
const id = route.params.id
const dlg = ref(false), cur = ref(null)
const fa = computed(() => idx.facilities.value.get(id))
const unloads = computed(() => state.unloads.filter((u) => u.facilityId === id))
</script>
