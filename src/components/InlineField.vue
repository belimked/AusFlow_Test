<template>
  <div class="inline-field" :class="{ editing }">
    <template v-if="!editing">
      <div class="value"><slot /></div>
      <el-tooltip :content="`Edit ${label}`" placement="top" :show-after="400">
        <el-icon class="pen" @click="start"><EditPen /></el-icon>
      </el-tooltip>
    </template>
    <div v-else class="editor">
      <el-select-v2 v-if="kind === 'location'" v-model="value" :options="locationOptions" filterable style="width: 100%" />
      <el-select v-else-if="kind === 'company'" v-model="value" clearable filterable placeholder="No hauler" style="width: 100%">
        <el-option v-for="c in haulers" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <el-select v-else-if="kind === 'status'" v-model="value" style="width: 100%">
        <el-option v-for="(l, v) in DEVICE_STATUS" :key="v" :label="l" :value="v" />
      </el-select>
      <el-select v-else-if="kind === 'choice'" v-model="value" filterable allow-create clearable style="width: 100%">
        <el-option v-for="o in choices" :key="o" :value="o" />
      </el-select>
      <el-input-number v-else-if="kind === 'number'" v-model="value" :min="0" :step="field === 'capacity' ? 250 : 1" style="width: 100%" />
      <el-date-picker v-else-if="kind === 'datetime'" v-model="value" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" style="width: 100%" />
      <MapPicker v-else-if="kind === 'coords'" v-model:lat="value.lat" v-model:lng="value.lng" style="width: 100%" />
      <el-input v-else v-model="value" :type="kind === 'textarea' ? 'textarea' : 'text'" :rows="3" @keyup.enter="kind === 'text' && commit()" />
      <div class="actions">
        <el-button size="small" type="primary" :icon="'Check'" @click="commit">Save</el-button>
        <el-button size="small" @click="editing = false">Cancel</el-button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import MapPicker from './MapPicker.vue'
import { state, haulers, updateDevice, DEVICE_STATUS, DEVICE_FIELDS } from '../store/db'

// field: a DEVICE_FIELDS key, or 'coords' for the lat/lng pair
const props = defineProps({ device: { type: Object, required: true }, field: { type: String, required: true } })

const KINDS = {
  locationId: 'location', companyId: 'company', status: 'status', type: 'choice', waste: 'choice', risk: 'choice',
  capacity: 'number', freqWeeks: 'number', lastService: 'datetime', locationDesc: 'textarea', comments: 'textarea', coords: 'coords'
}
const kind = computed(() => KINDS[props.field] || 'text')
const label = computed(() => props.field === 'coords' ? 'coordinates' : (DEVICE_FIELDS[props.field] || props.field).toLowerCase())
const choices = computed(() => props.field === 'risk'
  ? ['0', '1', '2', '3', '4', '5', '6', '7']
  : [...new Set(state.devices.map((d) => d[props.field]).filter(Boolean))].sort())
const locationOptions = computed(() => state.locations.map((l) => ({ value: l.id, label: `${l.name} — ${l.address1}, ${l.suburb}` })))

const editing = ref(false)
const value = ref(null)

function start() {
  const d = props.device
  value.value = props.field === 'coords' ? { lat: d.lat, lng: d.lng } : d[props.field]
  editing.value = true
}

function commit() {
  let patch
  if (props.field === 'coords') patch = { lat: value.value.lat ?? null, lng: value.value.lng ?? null }
  else if (kind.value === 'number') patch = { [props.field]: value.value ?? 0 }
  else if (kind.value === 'datetime') patch = { [props.field]: value.value ? new Date(value.value).toISOString() : null }
  else if (kind.value === 'company') patch = { [props.field]: value.value || null }
  else patch = { [props.field]: typeof value.value === 'string' ? value.value.trim() : value.value }
  if (props.field === 'locationId' && !patch.locationId) return ElMessage.warning('Please select a location')
  const n = updateDevice(props.device.id, patch, 'Web')
  ElMessage.success(n ? 'Saved and recorded in the change log' : 'No changes')
  editing.value = false
}
</script>
<style scoped>
.inline-field { display: flex; align-items: flex-start; gap: 6px; }
.inline-field .value { flex: 1; min-width: 0; word-break: break-word; }
.inline-field .pen { flex: none; margin-top: 3px; color: #a8abb2; cursor: pointer; opacity: .6; transition: opacity .15s, color .15s; }
.inline-field:hover .pen { opacity: 1; }
.inline-field .pen:hover { color: var(--el-color-primary); }
.inline-field.editing { display: block; }
.editor .actions { margin-top: 6px; display: flex; gap: 4px; }
</style>
