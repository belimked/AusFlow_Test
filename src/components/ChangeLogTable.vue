<template>
  <div>
    <el-table :data="paged" stripe size="small" empty-text="No change log entries">
      <el-table-column label="Time" width="160"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
      <el-table-column v-if="!hideDevice" label="Device" width="110"><template #default="{ row }"><span class="link" @click="router.push({ path: '/devices/' + row.deviceId, query: { tab: 'logs' } })">{{ row.deviceId }}</span></template></el-table-column>
      <el-table-column prop="field" label="Field" width="160" />
      <el-table-column label="Old value" min-width="160" show-overflow-tooltip><template #default="{ row }"><span class="muted">{{ row.oldValue || '(empty)' }}</span></template></el-table-column>
      <el-table-column label="New value" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.newValue || '(empty)' }}</template></el-table-column>
      <el-table-column prop="user" label="Changed by" width="140" />
      <el-table-column label="Source" width="90"><template #default="{ row }"><el-tag size="small" :type="{ Web: 'primary', App: 'success', CSV: 'warning' }[row.source]">{{ row.source }}</el-tag></template></el-table-column>
    </el-table>
    <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
  </div>
</template>
<script setup>
import { toRef } from 'vue'
import { useRouter } from 'vue-router'
import Pager from './Pager.vue'
import { usePaged } from '../composables/paged'
import { fmtTime } from '../store/db'

const props = defineProps({ rows: Array, hideDevice: Boolean })
const router = useRouter()
const { page, pageSize, rows: paged, total } = usePaged(toRef(props, 'rows'))
</script>
