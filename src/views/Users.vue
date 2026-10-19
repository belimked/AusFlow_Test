<template>
  <div class="page">
    <div class="card">
      <div class="toolbar">
        <el-input v-model="q" placeholder="Search username / name" clearable :prefix-icon="'Search'" style="width: 260px" />
        <el-select v-model="roleFilter" placeholder="Role" clearable style="width: 150px"><el-option v-for="(l, v) in ROLE_LABELS" :key="v" :label="l" :value="v" /></el-select>
        <span class="spacer" />
        <el-button type="primary" :icon="'Plus'" @click="edit(null)">Add user</el-button>
      </div>
      <el-table :data="rows" stripe v-loading="loading">
        <el-table-column label="Username" prop="username" width="160" />
        <el-table-column label="Display name" prop="displayName" min-width="200" />
        <el-table-column label="Email" prop="email" min-width="220"><template #default="{ row }">{{ row.email || '—' }}</template></el-table-column>
        <el-table-column label="Role" width="140"><template #default="{ row }"><el-tag size="small" :type="ROLE_TAG[row.role]">{{ ROLE_LABELS[row.role] || row.role }}</el-tag></template></el-table-column>
        <el-table-column label="Status" width="110"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? 'Active' : 'Inactive' }}</el-tag></template></el-table-column>
        <el-table-column label="Actions" width="220"><template #default="{ row }">
          <el-button link type="primary" @click="edit(row)">Edit</el-button>
          <el-button v-if="row.id !== me" link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggle(row)">{{ row.status === 'active' ? 'Deactivate' : 'Activate' }}</el-button>
        </template></el-table-column>
      </el-table>
      <div class="muted" style="margin-top: 12px">
        Admin: full access including user management and demo reset. Operations: edit business data, handle alerts and tickets. User: read-only.
      </div>
    </div>
    <el-dialog v-model="dlg" :title="form.id ? 'Edit user' : 'Add user'" width="460px">
      <el-form label-width="120px" @submit.prevent>
        <el-form-item label="Username" required><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="Display name" required><el-input v-model="form.displayName" /></el-form-item>
        <el-form-item label="Email"><el-input v-model="form.email" placeholder="Ticket notifications are sent here" /></el-form-item>
        <el-form-item label="Role" required>
          <el-radio-group v-model="form.role" :disabled="form.id === me"><el-radio-button v-for="(l, v) in ROLE_LABELS" :key="v" :value="v">{{ l }}</el-radio-button></el-radio-group>
        </el-form-item>
        <el-form-item :label="form.id ? 'New password' : 'Password'" :required="!form.id">
          <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? 'Leave empty to keep current' : 'At least 6 characters'" />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg = false">Cancel</el-button><el-button type="primary" :loading="saving" @click="submit">Save</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, currentUser, ROLE_LABELS } from '../store/api'

const ROLE_TAG = { admin: 'danger', ops: 'warning', user: 'info' }
const me = currentUser()?.id
const users = ref([])
const loading = ref(false)
const q = ref('')
const roleFilter = ref('')
const rows = computed(() => users.value.filter((u) => (!roleFilter.value || u.role === roleFilter.value) &&
  (!q.value || `${u.username} ${u.displayName}`.toLowerCase().includes(q.value.toLowerCase()))))

async function load() {
  loading.value = true
  try { users.value = await api('/users') } finally { loading.value = false }
}
onMounted(load)

const dlg = ref(false)
const saving = ref(false)
const form = reactive({ id: null, username: '', displayName: '', email: '', role: 'user', password: '' })
function edit(u) {
  Object.assign(form, { id: u?.id || null, username: u?.username || '', displayName: u?.displayName || '', email: u?.email || '', role: u?.role || 'user', password: '' })
  dlg.value = true
}
async function submit() {
  saving.value = true
  try {
    const { id, password, ...rest } = form
    const body = { ...rest, ...(password ? { password } : {}) }
    if (id) await api('/users/' + id, body, 'PATCH')
    else await api('/users', body)
    ElMessage.success('User saved')
    dlg.value = false
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}
async function toggle(u) {
  const status = u.status === 'active' ? 'inactive' : 'active'
  if (status === 'inactive') {
    try { await ElMessageBox.confirm(`${u.displayName} will no longer be able to sign in.`, 'Deactivate user', { type: 'warning' }) } catch { return }
  }
  try {
    await api('/users/' + u.id, { status }, 'PATCH')
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}
</script>
