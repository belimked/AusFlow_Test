<template>
  <el-popover v-model:visible="open" placement="bottom-end" :width="460" trigger="click" popper-style="padding: 0">
    <template #reference>
      <el-badge :value="unreadCount" :hidden="!unreadCount" :max="99" class="bell">
        <el-button circle :icon="'Bell'" />
      </el-badge>
    </template>
    <div class="head">
      <b>Alerts</b>
      <el-radio-group v-model="filter" size="small">
        <el-radio-button value="unread">Unread ({{ unreadCount }})</el-radio-button>
        <el-radio-button value="all">All ({{ alerts.length }})</el-radio-button>
      </el-radio-group>
    </div>
    <div style="max-height: 420px; overflow-y: auto">
      <AlertList :items="shown.slice(0, 30)" @navigate="open = false" />
    </div>
    <div class="foot">
      <el-button link type="primary" :disabled="!unreadCount" @click="markRead(alerts)">Mark all as read</el-button>
      <el-button link type="primary" @click="go">View all alerts →</el-button>
    </div>
  </el-popover>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AlertList from './AlertList.vue'
import { alerts, unreadCount, isRead, markRead } from '../store/alerts'

const router = useRouter()
const open = ref(false)
const filter = ref('unread')
const shown = computed(() => (filter.value === 'all' ? alerts.value : alerts.value.filter((a) => !isRead(a))))
function go() { open.value = false; router.push('/alerts') }
</script>
<style scoped>
.bell :deep(.el-badge__content) { z-index: 2; }
.head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #ebeef5; }
.foot { display: flex; justify-content: space-between; padding: 8px 12px; border-top: 1px solid #ebeef5; }
</style>
