<template>
  <div>
    <el-table @sort-change="onSort" :data="paged" stripe size="small">
      <el-table-column label="Device Ref" prop="ref" sortable="custom" width="100" fixed>
        <template #default="{ row }"><span class="link" @click="router.push('/devices/' + row.id)">{{ row.ref }}</span></template>
      </el-table-column>
      <el-table-column label="Device name" prop="aka" sortable="custom" min-width="170" show-overflow-tooltip />
      <el-table-column label="Tag ID" prop="tags" sortable="custom" width="138">
        <template #default="{ row }"><TagIds :device="row" /></template>
      </el-table-column>
      <el-table-column v-if="!hideLocation" label="Location" prop="locationId" sortable="custom" min-width="170" show-overflow-tooltip>
        <template #default="{ row }"><span class="link" @click="router.push('/locations/' + row.locationId)">{{ nameOf('locations', row.locationId) }}</span></template>
      </el-table-column>
      <el-table-column v-if="!hideLocation" label="Suburb" prop="suburb" sortable="custom" width="140"><template #default="{ row }">{{ suburbOf(row) }}</template></el-table-column>
      <el-table-column label="Device type" prop="type" sortable="custom" width="140" show-overflow-tooltip />
      <el-table-column label="Capacity" prop="capacity" sortable="custom" width="105" align="right"><template #default="{ row }">{{ fmtL(row.capacity) }}</template></el-table-column>
      <el-table-column label="Frequency" prop="freqWeeks" sortable="custom" width="100" align="right"><template #default="{ row }">{{ row.freqWeeks ? row.freqWeeks + ' wk' : '—' }}</template></el-table-column>
      <el-table-column label="Last service" prop="lastService" sortable="custom" width="120"><template #default="{ row }">{{ fmtDate(row.lastService) }}</template></el-table-column>
      <el-table-column label="Next service" prop="nextService" sortable="custom" width="120"><template #default="{ row }"><span :class="{ red: isOverdue(row) }">{{ fmtDate(nextService(row)) }}</span></template></el-table-column>
      <el-table-column label="Overdue" prop="overdueDays" sortable="custom" width="105"><template #default="{ row }"><span class="red">{{ overdueText(row) }}</span></template></el-table-column>
      <el-table-column v-if="!hideCompany" label="Responsible transport company" prop="companyId" sortable="custom" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.companyId ? nameOf('companies', row.companyId) : '—' }}</template></el-table-column>
      <el-table-column label="Owner" prop="ownerId" sortable="custom" min-width="160" show-overflow-tooltip><template #default="{ row }"><span v-if="row.ownerId" class="link" @click="router.push('/companies/' + row.ownerId)">{{ nameOf('companies', row.ownerId) }}</span><span v-else>—</span></template></el-table-column>
      <el-table-column label="Status" prop="status" sortable="custom" width="100"><template #default="{ row }"><el-tag :type="STATUS_TAG[row.status]" size="small">{{ DEVICE_STATUS[row.status] || row.status }}</el-tag></template></el-table-column>
      <slot />
    </el-table>
    <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
  </div>
</template>
<script setup>
import { computed, toRef, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import Pager from './Pager.vue'
import TagIds from './TagIds.vue'
import { usePaged } from '../composables/paged'
import { state, tagsOf, overdueDays, nameOf, nextService, isOverdue, overdueText, fmtDate, fmtL, DEVICE_STATUS } from '../store/db'

const props = defineProps({ rows: Array, hideLocation: Boolean, hideCompany: Boolean })
const STATUS_TAG = { Active: 'success', Inactive: 'info', Removed: 'danger' }
const router = useRouter()
const suburbMap = computed(() => new Map(state.locations.map((l) => [l.id, l.suburb || ''])))
const suburbOf = (d) => suburbMap.value.get(d.locationId) || ''
const { page, pageSize, rows: paged, sorted, onSort, total } = usePaged(toRef(props, 'rows'), 20, {
  tags: (d) => tagsOf(d)[0], suburb: suburbOf, nextService, overdueDays,
  locationId: (d) => nameOf('locations', d.locationId), companyId: (d) => d.companyId ? nameOf('companies', d.companyId) : '', ownerId: (d) => d.ownerId ? nameOf('companies', d.ownerId) : ''
})
const emit = defineEmits(['sorted'])
watchEffect(() => emit('sorted', sorted.value))
</script>
