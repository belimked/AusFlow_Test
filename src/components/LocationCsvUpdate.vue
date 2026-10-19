<template>
  <el-dialog :model-value="modelValue" title="Update locations via CSV" width="880" @update:model-value="close" @closed="reset">
    <div v-if="!plan">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px"
        title="Bulk-update existing locations"
        description="Download the template, edit the cells you want to change, then upload it. Rows are matched by Location ID. Only the columns present in your file are compared; a blank cell clears that value (Name is required). Changes are recorded in the Change Log (Source = CSV)." />
      <div class="toolbar" style="margin-bottom: 12px">
        <el-button :icon="'Download'" @click="downloadTemplate">Download template</el-button>
      </div>
      <el-upload drag :auto-upload="false" :show-file-list="false" accept=".csv" :on-change="onFile">
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">Drop a CSV file here, or <em>click to browse</em></div>
      </el-upload>
    </div>

    <div v-else>
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px" :title="`File: ${fileName}, ${plan.total} rows`" />
      <el-row :gutter="12" style="margin-bottom: 12px">
        <el-col :span="6" v-for="s in summary" :key="s.label">
          <div class="sum" :class="s.cls"><div class="muted">{{ s.label }}</div><div class="n">{{ s.value }}</div></div>
        </el-col>
      </el-row>
      <el-tabs v-model="previewTab" type="border-card">
        <el-tab-pane :label="`Changes (${changeRows.length})`" name="changes">
          <el-table :data="changeRows" size="small" max-height="360" empty-text="No changes">
            <el-table-column prop="id" label="Location ID" width="120" />
            <el-table-column prop="name" label="Name" min-width="180" show-overflow-tooltip />
            <el-table-column prop="field" label="Field" width="130" />
            <el-table-column label="Old → New" min-width="240"><template #default="{ row }"><span class="muted">{{ row.old }}</span> → {{ row.new }}</template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="`Errors (${plan.errors.length})`" name="errors">
          <el-table :data="plan.errors" size="small" max-height="360" empty-text="No errors">
            <el-table-column prop="line" label="Row" width="64" />
            <el-table-column label="Location ID" width="130"><template #default="{ row }">{{ row.id || '—' }}</template></el-table-column>
            <el-table-column label="Reason"><template #default="{ row }"><span class="red">{{ row.reasons.join('; ') }}</span></template></el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <template #footer>
      <el-button @click="plan ? reset() : close()">{{ plan ? 'Choose another file' : 'Cancel' }}</el-button>
      <el-button v-if="plan" type="primary" :disabled="!plan.updates.length" @click="apply">Apply {{ plan.updates.length }} updates</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { exportCsv, parseCsvText } from '../store/csv'
import { state, idx, nameOf, logEntityChange, CUSTODIAN, ENTITY_STATUS } from '../store/db'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const plan = ref(null), fileName = ref(''), previewTab = ref('changes')

const STRING_FIELDS = [
  { col: 'Name', key: 'name' }, { col: 'Agreement No', key: 'agreementNo' },
  { col: 'Address Line 1', key: 'address1' }, { col: 'Address Line 2', key: 'address2' },
  { col: 'Suburb', key: 'suburb' }, { col: 'State', key: 'state' }, { col: 'Postcode', key: 'postcode' }
]
const companyByName = computed(() => new Map(state.companies.map((c) => [c.name.trim().toLowerCase(), c])))

function close() { emit('update:modelValue', false) }
function reset() { plan.value = null; fileName.value = '' }

function downloadTemplate() {
  exportCsv('locations-template', state.locations.map((l) => ({
    'Location ID': l.id, Name: l.name, 'Agreement No': l.agreementNo || '', Custodian: CUSTODIAN[l.custodianCategory] || '',
    'Address Line 1': l.address1 || '', 'Address Line 2': l.address2 || '', Suburb: l.suburb || '', State: l.state || '', Postcode: l.postcode || '',
    Latitude: l.lat ?? '', Longitude: l.lng ?? '', Status: l.status,
    Owner: l.ownerId ? nameOf('companies', l.ownerId) : '', Occupier: l.occupierId ? nameOf('companies', l.occupierId) : ''
  })))
}

function onFile(f) { f.raw.text().then((t) => build(t, f.name)) }

const disp = (key, v) => {
  if (key === 'custodianCategory') return CUSTODIAN[v] || '(Unspecified)'
  if (key === 'status') return ENTITY_STATUS[v] || v
  if (key === 'ownerId' || key === 'occupierId') return v ? nameOf('companies', v) : '—'
  if (key === 'lat' || key === 'lng') return v == null ? '(empty)' : String(v)
  return v || '(empty)'
}
const toNum = (v) => { const s = (v ?? '').toString().trim(); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : NaN }
function resolveFrom(map, s) {
  const t = (s || '').trim()
  if (t === '') return { value: null }
  const lc = t.toLowerCase()
  for (const [k, label] of Object.entries(map)) if (k.toLowerCase() === lc || label.toLowerCase() === lc) return { value: k }
  return { error: true }
}

function build(text, name) {
  const rows = parseCsvText(text)
  if (!rows.length || !('Location ID' in rows[0])) return ElMessage.error('CSV must contain a "Location ID" column')
  const cols = Object.keys(rows[0])
  const hasLat = cols.includes('Latitude'), hasLng = cols.includes('Longitude')
  if (hasLat !== hasLng) return ElMessage.error('Provide both Latitude and Longitude columns, or neither')

  const updates = [], errors = []
  let unchanged = 0
  rows.forEach((r, i) => {
    const line = i + 2
    const id = (r['Location ID'] || '').trim()
    const loc = idx.locations.value.get(id)
    if (!loc) return errors.push({ line, id, reasons: [id ? `Unknown Location ID: "${id}"` : 'Missing Location ID'] })
    const reasons = [], changes = []
    const change = (key, col, value) => {
      const old = loc[key] ?? null
      if ((old ?? null) !== (value ?? null)) changes.push({ key, field: col, old: disp(key, old), new: disp(key, value), value })
    }
    for (const { col, key } of STRING_FIELDS) {
      if (!(col in r)) continue
      const v = (r[col] || '').trim()
      if (key === 'name' && !v) { reasons.push('Name is required'); continue }
      change(key, col, v)
    }
    if ('Custodian' in r) {
      const res = resolveFrom(CUSTODIAN, r.Custodian)
      if (res.error) reasons.push(`Invalid custodian: "${(r.Custodian || '').trim()}"`)
      else change('custodianCategory', 'Custodian', res.value)
    }
    if ('Status' in r) {
      const res = resolveFrom(ENTITY_STATUS, r.Status)
      if (res.error || res.value == null) reasons.push(`Invalid status: "${(r.Status || '').trim()}"`)
      else change('status', 'Status', res.value)
    }
    for (const [col, key] of [['Owner', 'ownerId'], ['Occupier', 'occupierId']]) {
      if (!(col in r)) continue
      const t = (r[col] || '').trim()
      if (!t) { change(key, col, null); continue }
      const c = companyByName.value.get(t.toLowerCase())
      if (!c) reasons.push(`Unknown ${col.toLowerCase()} company: "${t}"`)
      else change(key, col, c.id)
    }
    if (hasLat) {
      const lat = toNum(r.Latitude), lng = toNum(r.Longitude)
      if ((lat == null) !== (lng == null) || Number.isNaN(lat) || Number.isNaN(lng) || (lat != null && (lat < -90 || lat > 90)) || (lng != null && (lng < -180 || lng > 180))) {
        reasons.push('Invalid coordinates: latitude and longitude must both be valid')
      } else {
        change('lat', 'Latitude', lat)
        change('lng', 'Longitude', lng)
      }
    }
    if (reasons.length) errors.push({ line, id, reasons })
    else if (changes.length) updates.push({ line, id, name: loc.name, changes })
    else unchanged++
  })
  fileName.value = name
  plan.value = { total: rows.length, updates, errors, unchanged }
  previewTab.value = updates.length || !errors.length ? 'changes' : 'errors'
}

const changeRows = computed(() => plan.value.updates.flatMap((u) => u.changes.map((c) => ({ id: u.id, name: u.name, field: c.field, old: c.old, new: c.new }))))
const summary = computed(() => [
  { label: 'Rows', value: plan.value.total },
  { label: 'To update', value: plan.value.updates.length, cls: 'upd' },
  { label: 'Unchanged', value: plan.value.unchanged },
  { label: 'Errors', value: plan.value.errors.length, cls: 'err' }
])

function apply() {
  for (const u of plan.value.updates) {
    const loc = idx.locations.value.get(u.id)
    for (const c of u.changes) {
      logEntityChange('location', u.id, c.field, c.old, c.new, 'CSV')
      loc[c.key] = c.value
    }
  }
  ElMessage.success(`Updated ${plan.value.updates.length} location${plan.value.updates.length === 1 ? '' : 's'}`)
  close()
}
</script>
<style scoped>
.sum { background: #f6f8fa; border-radius: 6px; padding: 10px 14px; }
.sum .n { font-size: 22px; font-weight: 700; }
.sum.upd .n { color: #409eff; } .sum.err .n { color: #d93025; }
</style>
