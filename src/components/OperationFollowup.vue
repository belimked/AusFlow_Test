<template>
  <div class="card" style="margin-top: 12px">
    <h4>Warnings</h4>
    <el-table :data="warnings" size="small" empty-text="No warnings">
      <el-table-column label="Type" min-width="120"><template #default="{ row }">{{ ALERT_TYPES[row.type] }}</template></el-table-column>
      <el-table-column label="Severity" prop="severity" width="90" />
      <el-table-column label="Title" min-width="180"><template #default="{ row }"><span class="link" @click="showAlert(row)">{{ row.title }}</span></template></el-table-column>
      <el-table-column label="Status" width="110"><template #default="{ row }">{{ ALERT_STATUS[row.status] }}</template></el-table-column>
    </el-table>
    <el-button v-can="'write'" type="warning" :disabled="!warnings.some(isActive)" style="margin-top: 8px" @click="clearWarnings(kind, id, warnings)">Clear warnings</el-button>
    <h4>Notes</h4>
    <div v-if="appNote" class="muted">Transporter notes · App: {{ appNote }}</div>
    <div v-for="n in notes" :key="n.id" style="padding: 6px 0; border-bottom: 1px solid #eee">{{ n.text }} <span class="muted">· {{ n.source }} · {{ n.user }} · {{ fmtTime(n.at) }}</span></div>
    <el-input v-can="'write'" v-model="text" type="textarea" placeholder="Add note" style="margin-top: 8px" />
    <el-button v-can="'write'" type="primary" :disabled="!text.trim()" style="margin-top: 6px" @click="add">Add note</el-button>
    <h4>Changes</h4>
    <div v-for="l in logs" :key="l.id" style="padding: 6px 0">{{ l.field }}: {{ l.oldValue }} → {{ l.newValue }} <span class="muted">· {{ l.user }} · {{ fmtTime(l.at) }}</span></div>
    <div v-if="!logs.length" class="muted">No changes</div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { state, addEntityNote, fmtTime } from '../store/db'
import { warningsFor, isActive, showAlert, ALERT_TYPES, ALERT_STATUS } from '../store/alerts'
import { clearWarnings } from '../store/warningActions'
const props = defineProps({ kind: String, id: String, appNote: String })
const text = ref('')
const warnings = computed(() => warningsFor(props.kind, props.id))
const notes = computed(() => state.notes.filter((n) => n.entityType === props.kind && n.entityId === props.id))
const logs = computed(() => state.changeLogs.filter((l) => l.entityType === props.kind && l.entityId === props.id))
function add() { addEntityNote(props.kind, props.id, text.value); text.value = '' }
</script>
