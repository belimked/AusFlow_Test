<template>
  <el-dialog v-model="visible" :title="title" :width="hasMap ? '720px' : '520px'" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="140px">
      <el-form-item v-for="f in fields" :key="f.key" :label="f.label" :prop="f.key">
        <el-select v-if="f.type === 'select'" v-model="form[f.key]" filterable :disabled="f.disabled" style="width: 100%">
          <el-option v-for="o in f.options" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-else-if="f.type === 'multiselect'" v-model="form[f.key]" multiple style="width: 100%"><el-option v-for="o in f.options" :key="o.value" :label="o.label" :value="o.value" /></el-select>
        <el-radio-group v-else-if="f.type === 'radio'" v-model="form[f.key]">
          <el-radio v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</el-radio>
        </el-radio-group>
        <el-input-number v-else-if="f.type === 'number'" v-model="form[f.key]" :min="0" :step="f.step || 1" style="width: 200px" />
        <el-input v-else-if="f.type === 'qr'" v-model="form[f.key]">
          <template #append><el-button @click="form[f.key] = (f.prefix || '') + code(10)">Generate</el-button></template>
        </el-input>
        <AddressAutocomplete v-else-if="f.type === 'address'" v-model="form[f.key]" :near="form"
          placeholder="Start typing a street address" @select="(s) => selectAddress(f.key, s)" />
        <MapPicker v-else-if="f.type === 'map'" v-model:lat="form.lat" v-model:lng="form.lng" style="width: 100%" />
        <el-input v-else v-model="form[f.key]" :placeholder="f.placeholder" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">Cancel</el-button>
      <el-button type="primary" @click="submit">Save</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MapPicker from './MapPicker.vue'
import AddressAutocomplete from './AddressAutocomplete.vue'

// fields: [{ key, label, type?, options?, required?, validator? }]
const props = defineProps({ title: String, fields: Array, record: Object, defaults: Object })
const emit = defineEmits(['submit'])
const visible = defineModel({ type: Boolean })
const formRef = ref()
const form = reactive({})
const hasMap = computed(() => props.fields.some((f) => f.type === 'map'))
const code = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
const rules = computed(() => Object.fromEntries(props.fields.filter((f) => f.required || f.validator).map((f) => [f.key, [
  ...(f.required ? [{ required: true, message: `${f.label} is required` }] : []),
  ...(f.validator ? [{ validator: (_, v, cb) => { const msg = f.validator(v, form); msg ? cb(new Error(msg)) : cb() } }] : [])
]])))

watch(visible, (v) => {
  if (!v) return
  for (const k of Object.keys(form)) delete form[k]
  Object.assign(form, props.defaults || {}, props.record ? JSON.parse(JSON.stringify(props.record)) : {})
  for (const f of props.fields.filter((f) => f.type === 'multiselect')) {
    try { form[f.key] = typeof form[f.key] === 'string' ? JSON.parse(form[f.key]) : (form[f.key] || []) } catch { form[f.key] = [] }
  }
})

function selectAddress(key, item) {
  form[key] = item.label
  if (hasMap.value) { form.lat = item.lat; form.lng = item.lng }
}

async function submit() {
  await formRef.value.validate()
  emit('submit', { ...form })
  ElMessage.success('Saved')
  visible.value = false
}
</script>
