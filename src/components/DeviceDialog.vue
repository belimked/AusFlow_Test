<template>
  <el-dialog v-model="visible" :title="record ? `Edit Device ${record.ref}` : 'Add Device'" width="960px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="170px">
      <el-row :gutter="12">
        <el-col :span="24"><el-form-item label="Location" prop="locationId">
          <el-select-v2 v-model="form.locationId" :options="locationOptions" filterable placeholder="Search location name or address" style="width: 100%" />
        </el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Device Ref" prop="ref"><el-input v-model="form.ref" :disabled="!!record" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Device name"><el-input v-model="form.aka" placeholder="Device AKA" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Device type" prop="type">
          <el-select v-model="form.type" filterable allow-create style="width: 100%"><el-option v-for="t in types" :key="t" :value="t" /></el-select>
        </el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Waste type">
          <el-select v-model="form.waste" filterable allow-create style="width: 100%"><el-option v-for="t in wastes" :key="t" :value="t" /></el-select>
        </el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Capacity (L)" prop="capacity"><el-input-number v-model="form.capacity" :min="0" :step="250" style="width: 100%" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Service frequency (weeks)"><el-input-number v-model="form.freqWeeks" :min="0" :max="520" style="width: 100%" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Approval category"><el-input v-model="form.approvalCategory" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Risk rating"><el-select v-model="form.risk" clearable style="width: 100%"><el-option v-for="r in ['0','1','2','3','4','5','6','7']" :key="r" :value="r" /></el-select></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Owner">
          <el-select v-model="form.ownerId" clearable filterable placeholder="Owner company" style="width: 100%"><el-option v-for="c in owners" :key="c.id" :label="c.name" :value="c.id" /></el-select>
        </el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Status">
          <el-radio-group v-model="form.status"><el-radio v-for="(l, v) in DEVICE_STATUS" :key="v" :value="v">{{ l }}</el-radio></el-radio-group>
        </el-form-item></el-col>
        <el-col :span="12"><el-form-item label="QR code">
          <el-input v-model="form.qr"><template #append><el-button @click="form.qr = genQr()">Generate</el-button></template></el-input>
        </el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Last service"><el-date-picker v-model="form.lastService" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" style="width: 100%" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Tag ID"><el-input v-model="form.tags" placeholder="Tag code(s), space separated" /></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="Location description"><el-input v-model="form.locationDesc" type="textarea" :rows="2" /></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="Comments"><el-input v-model="form.comments" type="textarea" :rows="2" /></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="Device coordinates"><MapPicker v-model:lat="form.lat" v-model:lng="form.lng" style="width: 100%" /></el-form-item></el-col>
      </el-row>
    </el-form>
    <template #footer>
      <span v-if="record" class="muted" style="float: left; line-height: 32px">Changes are recorded in the change log automatically</span>
      <el-button @click="visible = false">Cancel</el-button>
      <el-button type="primary" @click="submit">Save</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MapPicker from './MapPicker.vue'
import { state, idx, updateDevice, createDevice, DEVICE_STATUS, isTransport } from '../store/db'

const visible = defineModel({ type: Boolean })
const props = defineProps({ record: Object, defaults: Object })
const emit = defineEmits(['saved'])
const formRef = ref()
const genQr = () => Array.from({ length: 12 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
const genRef = () => { let r; do r = 'DV' + (900000 + Math.floor(Math.random() * 99999)); while (idx.devices.value.has(r)); return r }
const blank = () => ({
  locationId: '', ref: genRef(), aka: '', status: 'Active', type: 'Grease Arrestor', waste: 'Grease Trap Waste', capacity: 1000,
  freqWeeks: 13, lastService: null, approvalCategory: '', risk: '', locationDesc: '', ownerId: null, qr: genQr(), tags: '', lat: null, lng: null, comments: ''
})
const form = reactive(blank())
const rules = {
  locationId: [{ required: true, message: 'Please select a location' }],
  ref: [{ required: true, message: 'Please enter a Device Ref' }, { validator: (_, v, cb) => (!props.record && idx.devices.value.has(v) ? cb(new Error('Device Ref already exists')) : cb()) }],
  type: [{ required: true, message: 'Please select a device type' }]
}
const locationOptions = computed(() => state.locations.map((l) => ({ value: l.id, label: `${l.name} — ${l.address1}, ${l.suburb}` })))
const types = computed(() => [...new Set(state.devices.map((d) => d.type).filter(Boolean))].sort())
const owners = computed(() => state.companies.filter((c) => !isTransport(c)))
const wastes = computed(() => [...new Set(state.devices.map((d) => d.waste).filter(Boolean))].sort())

watch(visible, (v) => {
  if (!v) return
  Object.assign(form, blank(), props.defaults || {}, props.record ? JSON.parse(JSON.stringify(props.record)) : {})
  if (!props.record && form.locationId && form.lat == null) {
    const loc = idx.locations.value.get(form.locationId)
    if (loc) { form.lat = loc.lat; form.lng = loc.lng }
  }
})

async function submit() {
  await formRef.value.validate()
  const data = { ...form, capacity: form.capacity ?? 0, freqWeeks: form.freqWeeks ?? 0 }
  delete data.companyId // Legacy DB field is not editable, even for existing records or defaults.
  if (data.lastService) data.lastService = new Date(data.lastService).toISOString()
  if (props.record) {
    const n = updateDevice(props.record.id, data, 'Web')
    ElMessage.success(n ? `Saved. ${n} field(s) recorded in the change log` : 'No changes')
  } else {
    createDevice(data, 'Web')
    ElMessage.success('Device added')
  }
  visible.value = false
  emit('saved', data.ref)
}
</script>
