<template>
  <div>
    <el-table :data="paged" stripe size="small">
      <el-table-column label="Device Ref" width="100" fixed>
        <template #default="{ row }"><span class="link" @click="router.push('/devices/' + row.id)">{{ row.ref }}</span></template>
      </el-table-column>
      <el-table-column prop="aka" label="Device name" min-width="170" show-overflow-tooltip />
      <el-table-column label="Tag ID" width="138">
        <template #default="{ row }"><TagIds :device="row" /></template>
      </el-table-column>
      <el-table-column v-if="!hideLocation" label="Location" min-width="170" show-overflow-tooltip>
        <template #default="{ row }"><span class="link" @click="router.push('/locations/' + row.locationId)">{{ nameOf('locations', row.locationId) }}</span></template>
      </el-table-column>
      <el-table-column prop="type" label="Device type" width="140" show-overflow-tooltip />
      <el-table-column label="Capacity" width="105" align="right"><template #default="{ row }">{{ fmtL(row.capacity) }}</template></el-table-column>
      <el-table-column label="Frequency" width="100" align="right"><template #default="{ row }">{{ row.freqWeeks ? row.freqWeeks + ' wk' : '—' }}</template></el-table-column>
      <el-table-column label="Last service" width="120"><template #default="{ row }">{{ fmtDate(row.lastService) }}</template></el-table-column>
      <el-table-column label="Next service" width="120"><template #default="{ row }"><span :class="{ red: isOverdue(row) }">{{ fmtDate(nextService(row)) }}</span></template></el-table-column>
      <el-table-column label="Overdue" width="105"><template #default="{ row }"><span class="red">{{ overdueText(row) }}</span></template></el-table-column>
      <el-table-column v-if="!hideCompany" label="Responsible hauler" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.companyId ? nameOf('companies', row.companyId) : '—' }}</template></el-table-column>
      <el-table-column label="Status" width="100"><template #default="{ row }"><el-tag :type="STATUS_TAG[row.status]" size="small">{{ DEVICE_STATUS[row.status] || row.status }}</el-tag></template></el-table-column>
      <slot />
    </el-table>
    <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
  </div>
</template>
<script setup>
import { toRef } from 'vue'
import { useRouter } from 'vue-router'
import Pager from './Pager.vue'
import TagIds from './TagIds.vue'
import { usePaged } from '../composables/paged'
import { nameOf, nextService, isOverdue, overdueText, fmtDate, fmtL, DEVICE_STATUS } from '../store/db'

const props = defineProps({ rows: Array, hideLocation: Boolean, hideCompany: Boolean })
const STATUS_TAG = { Active: 'success', Inactive: 'info', Removed: 'danger' }
const router = useRouter()
const { page, pageSize, rows: paged, total } = usePaged(toRef(props, 'rows'))
</script>
