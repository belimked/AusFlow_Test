<template>
  <div>
    <el-table @sort-change="onSort" :data="paged" stripe size="small" empty-text="No change log entries">
      <el-table-column label="Time" prop="at" sortable="custom" width="160"><template #default="{ row }">{{ fmtTime(row.at) }}</template></el-table-column>
      <el-table-column v-if="!hideDevice" label="Device" prop="deviceId" sortable="custom" width="110"><template #default="{ row }"><span class="link" @click="router.push({ path: '/devices/' + row.deviceId, query: { tab: 'logs' } })">{{ row.deviceId }}</span></template></el-table-column>
      <el-table-column label="Field" prop="field" sortable="custom" width="160" />
      <el-table-column label="Old value" prop="oldValue" sortable="custom" min-width="160" show-overflow-tooltip><template #default="{ row }"><span class="muted">{{ row.oldValue || '(empty)' }}</span></template></el-table-column>
      <el-table-column label="New value" prop="newValue" sortable="custom" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.newValue || '(empty)' }}</template></el-table-column>
      <el-table-column label="Changed by" prop="user" sortable="custom" width="140" />
      <el-table-column label="Source" prop="source" sortable="custom" width="90"><template #default="{ row }"><el-tag size="small" :type="{ Web: 'primary', App: 'success', CSV: 'warning' }[row.source]">{{ row.source }}</el-tag></template></el-table-column>
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
const { page, pageSize, rows: paged, sorted, onSort, total } = usePaged(toRef(props, 'rows'))
</script>
