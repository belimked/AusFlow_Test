<template>
  <div class="page">
    <div class="card">
      <el-tabs v-model="tab">
        <el-tab-pane v-if="can('write')" label="CSV Import" name="upload">
          <el-steps :active="step" finish-status="success" simple style="margin-bottom: 16px">
            <el-step title="Upload file" /><el-step title="Review" /><el-step title="Done" />
          </el-steps>

          <div v-if="step === 0">
            <el-upload drag :auto-upload="false" :show-file-list="false" accept=".csv" :on-change="onFile">
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">Drop a CSV file here, or <em>click to browse</em></div>
              <template #tip>
                <div class="el-upload__tip">Supports the existing Device Export CSV format. Rows are matched by <b>Device Ref</b>: existing devices are updated, new ones are added.</div>
              </template>
            </el-upload>
            <div class="toolbar" style="margin-top: 12px">
              <el-button :icon="'Document'" @click="loadSample">Use demo sample file (105 rows: new / updated / errors)</el-button>
              <span v-if="parsing" class="muted"><el-icon class="is-loading"><Loading /></el-icon> Parsing…</span>
            </div>
          </div>

          <div v-if="step === 1 && plan">
            <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px"
              :title="`File: ${fileName}, ${rowCount} rows`"
              description="Review the results before importing. Updates are recorded in the Change Log (Source = CSV Import). Serviced By maps to the device’s Responsible transport company; Last service is only overwritten when the CSV date is newer." />
            <el-row :gutter="12" style="margin-bottom: 12px">
              <el-col :span="4" v-for="s in summary" :key="s.label">
                <div class="sum" :class="s.cls"><div class="muted">{{ s.label }}</div><div class="n">{{ s.value }}</div></div>
              </el-col>
            </el-row>
            <el-tabs v-model="previewTab" type="border-card">
              <el-tab-pane :label="`New (${plan.adds.length})`" name="adds">
                <el-table :data="plan.adds.slice(0, 300)" size="small" max-height="380">
                  <el-table-column prop="line" label="Row" width="64" />
                  <el-table-column prop="device.ref" label="Device Ref" width="100" />
                  <el-table-column prop="device.aka" label="Device name" min-width="160" show-overflow-tooltip />
                  <el-table-column label="Location" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ row.row['Location Names'] }} — {{ row.row['Address Line 1'] }}
                    <el-tag v-if="plan.newLocations.has(row.locKey)" size="small" type="warning">New location</el-tag></template></el-table-column>
                  <el-table-column prop="device.type" label="Device type" width="140" />
                  <el-table-column prop="device.status" label="Status" width="90" />
                </el-table>
              </el-tab-pane>
              <el-tab-pane :label="`Updated (${plan.updates.length})`" name="updates">
                <el-table :data="plan.updates.slice(0, 300)" size="small" max-height="380">
                  <el-table-column prop="line" label="Row" width="64" />
                  <el-table-column prop="device.ref" label="Device Ref" width="100" />
                  <el-table-column label="Changed fields">
                    <template #default="{ row }">
                      <div v-for="f in row.fields" :key="f">
                        <b>{{ DEVICE_FIELDS[f] }}</b>: <span class="muted">{{ show(f, idx.devices.value.get(row.device.ref)[f]) }}</span> → {{ show(f, row.patch[f]) }}
                      </div>
                      <div v-if="!row.fields.length" class="muted">Location or transport company will be created and linked on import</div>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
              <el-tab-pane :label="`Errors (${plan.errors.length})`" name="errors">
                <el-table :data="plan.errors" size="small" max-height="380">
                  <el-table-column prop="line" label="Row" width="64" />
                  <el-table-column label="Device Ref" width="110"><template #default="{ row }">{{ row.ref || '—' }}</template></el-table-column>
                  <el-table-column label="Reason"><template #default="{ row }"><span class="red">{{ row.reasons.join('; ') }}</span></template></el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
            <div class="toolbar" style="margin-top: 12px; justify-content: flex-end">
              <el-button @click="step = 0">Choose another file</el-button>
              <el-button type="primary" :disabled="!plan.adds.length && !plan.updates.length" @click="execute">
                Import (add {{ plan.adds.length }}, update {{ plan.updates.length }}, skip {{ plan.errors.length }} errors)
              </el-button>
            </div>
          </div>

          <el-result v-if="step === 2 && result" icon="success" title="Import complete"
            :sub-title="`Added ${result.added}, updated ${result.updated}, unchanged ${result.unchanged}, errors ${result.failed}`">
            <template #extra>
              <el-button type="primary" @click="router.push('/devices')">View devices</el-button>
              <el-button @click="router.push('/change-logs')">View change log</el-button>
              <el-button @click="reset">Import another</el-button>
            </template>
          </el-result>
        </el-tab-pane>

        <el-tab-pane :label="`Import History (${state.importLogs.length})`" name="history">
          <el-table :data="state.importLogs" stripe size="small" empty-text="No import history">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div style="padding: 0 48px">
                  <div v-if="!row.errors.length" class="muted">No errors</div>
                  <div v-for="e in row.errors" :key="e.line" class="red">Row {{ e.line }} {{ e.ref }}: {{ e.reasons.join('; ') }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="Time" width="160"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
            <el-table-column prop="user" label="User" width="130" />
            <el-table-column prop="fileName" label="File" min-width="220" show-overflow-tooltip />
            <el-table-column prop="total" label="Rows" width="80" align="right" />
            <el-table-column prop="added" label="Added" width="80" align="right" />
            <el-table-column prop="updated" label="Updated" width="90" align="right" />
            <el-table-column prop="unchanged" label="Unchanged" width="105" align="right" />
            <el-table-column label="Errors" width="80" align="right"><template #default="{ row }"><span :class="{ red: row.failed }">{{ row.failed }}</span></template></el-table-column>
            <el-table-column label="New locations / transport companies" width="190" align="right"><template #default="{ row }">{{ row.newLocations }} / {{ row.newCompanies }}</template></el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { parseCsvText } from '../store/csv'
import { previewImport, executeImport } from '../store/importer'
import { state, idx, nameOf, fmtTime, fmtDate, DEVICE_FIELDS, DEVICE_STATUS } from '../store/db'
import { can } from '../store/api'

const router = useRouter()
const tab = ref(can('write') ? 'upload' : 'history'), step = ref(0), previewTab = ref('adds'), parsing = ref(false)
const plan = ref(null), result = ref(null), fileName = ref(''), rowCount = ref(0)

const REQUIRED = ['Device Ref', 'Status', 'Device Type', 'Capacity', 'Service Frequency', 'Location Names', 'Address Line 1']
async function handleText(text, name) {
  parsing.value = true
  await new Promise((r) => setTimeout(r, 30))
  try {
    const rows = parseCsvText(text)
    const missing = REQUIRED.filter((c) => !(rows[0] && c in rows[0]))
    if (missing.length) return ElMessage.error(`Not a valid device export – missing columns: ${missing.join(', ')}`)
    fileName.value = name
    rowCount.value = rows.length
    plan.value = previewImport(rows)
    previewTab.value = plan.value.adds.length ? 'adds' : plan.value.updates.length ? 'updates' : 'errors'
    step.value = 1
  } finally {
    parsing.value = false
  }
}
function onFile(f) { f.raw.text().then((t) => handleText(t, f.name)) }
async function loadSample() {
  const res = await fetch('samples/device-export-sample.csv')
  handleText(await res.text(), 'device-export-sample.csv')
}
const summary = computed(() => [
  { label: 'New', value: plan.value.adds.length, cls: 'ok' },
  { label: 'Updated', value: plan.value.updates.length, cls: 'upd' },
  { label: 'Unchanged', value: plan.value.unchanged },
  { label: 'Errors', value: plan.value.errors.length, cls: 'err' },
  { label: 'New locations', value: plan.value.newLocations.size },
  { label: 'New transport companies', value: plan.value.newCompanies.size }
])
const show = (f, v) => {
  if (v == null || v === '') return '(empty)'
  if (f === 'locationId') return nameOf('locations', v)
  if (f === 'companyId') return nameOf('companies', v)
  if (f === 'status') return DEVICE_STATUS[v] || v
  if (f === 'lastService') return fmtDate(v)
  return v
}
async function execute() {
  try { await ElMessageBox.confirm('Import now? Rows with errors will be skipped.', 'Confirm import', { type: 'warning' }) } catch { return }
  result.value = executeImport(plan.value, fileName.value)
  step.value = 2
}
function reset() { plan.value = null; result.value = null; step.value = 0 }
</script>
<style scoped>
.sum { background: #f6f8fa; border-radius: 6px; padding: 10px 14px; }
.sum .n { font-size: 22px; font-weight: 700; }
.sum.ok .n { color: #67c23a; } .sum.upd .n { color: #409eff; } .sum.err .n { color: #d93025; }
</style>
