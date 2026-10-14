<template>
  <el-dialog v-model="visible" :title="record ? 'Edit Location' : 'Add Location'" width="720px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="Location name" prop="name"><el-input v-model="form.name" /></el-form-item>
      <el-row>
        <el-col :span="12"><el-form-item label="Agreement No."><el-input v-model="form.agreementNo" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="Status">
          <el-radio-group v-model="form.status"><el-radio value="active">Active</el-radio><el-radio value="inactive">Inactive</el-radio></el-radio-group>
        </el-form-item></el-col>
      </el-row>
      <el-form-item label="Address" prop="address1">
        <AddressAutocomplete v-model="form.address1" placeholder="Start typing a street address" :near="form" @select="pickAddress" />
      </el-form-item>
      <el-form-item label="Address 2"><el-input v-model="form.address2" /></el-form-item>
      <el-row>
        <el-col :span="10"><el-form-item label="Suburb" prop="suburb"><el-input v-model="form.suburb" placeholder="Suburb" /></el-form-item></el-col>
        <el-col :span="7"><el-form-item label="State" label-width="60px"><el-select v-model="form.state"><el-option v-for="s in STATES" :key="s" :value="s" /></el-select></el-form-item></el-col>
        <el-col :span="7"><el-form-item label="Postcode" label-width="85px"><el-input v-model="form.postcode" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="Coordinates"><MapPicker v-model:lat="form.lat" v-model:lng="form.lng" style="width: 100%" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">Cancel</el-button>
      <el-button type="primary" @click="submit">Save</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MapPicker from './MapPicker.vue'
import AddressAutocomplete from './AddressAutocomplete.vue'
import { state, nextId, save } from '../store/db'

const STATES = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT']
const visible = defineModel({ type: Boolean })
const props = defineProps({ record: Object })
const emit = defineEmits(['saved'])
const formRef = ref()
const blank = () => ({ name: '', agreementNo: '', address1: '', address2: '', suburb: '', state: 'QLD', postcode: '', lat: null, lng: null, status: 'active' })
const form = reactive(blank())
const rules = {
  name: [{ required: true, message: 'Please enter a location name' }],
  address1: [{ required: true, message: 'Please enter an address' }],
  suburb: [{ required: true, message: 'Please enter a suburb' }]
}
watch(visible, (v) => v && Object.assign(form, blank(), props.record ? { ...props.record } : {}))

function pickAddress(s) {
  Object.assign(form, { address1: s.address1, suburb: s.suburb, postcode: s.postcode, lat: s.lat, lng: s.lng })
  if (STATES.includes(s.state)) form.state = s.state
  if (!form.name.trim() && s.place) form.name = s.place
}

async function submit() {
  await formRef.value.validate()
  const data = { ...form, suburb: form.suburb.trim().toUpperCase() }
  if (props.record) Object.assign(props.record, data)
  else state.locations.unshift({ ...data, id: nextId('LO') })
  save()
  ElMessage.success('Saved')
  visible.value = false
  emit('saved')
}
</script>
