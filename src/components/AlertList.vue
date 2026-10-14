<template>
  <div class="alert-list">
    <div v-for="a in items" :key="a.id" class="alert" :class="[a.severity, { read: isRead(a) }]" @click="open(a)">
      <el-icon class="ico" :size="18"><component :is="ICONS[a.type]" /></el-icon>
      <div class="body">
        <div class="title">{{ a.title }}</div>
        <div class="detail">{{ a.detail }}</div>
      </div>
      <div class="meta">
        <el-tag size="small" :type="TAG[a.severity]" effect="light">{{ ALERT_TYPES[a.type] }}</el-tag>
        <div class="time">{{ ago(a.at) }}</div>
      </div>
    </div>
    <el-empty v-if="!items.length" description="No alerts" :image-size="60" />
  </div>
</template>
<script setup>
import { useRouter } from 'vue-router'
import { ALERT_TYPES, isRead, markRead } from '../store/alerts'

defineProps({ items: Array })
const emit = defineEmits(['navigate'])
const router = useRouter()
const TAG = { critical: 'danger', warning: 'warning', info: 'info' }
const ICONS = { overdue: 'AlarmClock', longJob: 'Timer', location: 'Location', capacity: 'Histogram', nolocation: 'Position', vehicleFull: 'Van', pendingDriver: 'User' }
function ago(s) {
  const m = Math.round((Date.now() - new Date(s).getTime()) / 6e4)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}
function open(a) {
  markRead([a])
  emit('navigate')
  router.push(a.to)
}
</script>
<style scoped>
.alert { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-left: 3px solid transparent; border-bottom: 1px solid #f0f2f5; cursor: pointer; background: #fff; }
.alert:hover { background: #f7f9fc; }
.alert.critical { border-left-color: #f56c6c; }
.alert.warning { border-left-color: #e6a23c; }
.alert.info { border-left-color: #909399; }
.alert.critical .ico { color: #f56c6c; } .alert.warning .ico { color: #e6a23c; } .alert.info .ico { color: #909399; }
.alert.read { opacity: .55; }
.alert:not(.read) .title::before { content: ''; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #409eff; margin-right: 6px; vertical-align: 1px; }
.body { flex: 1; min-width: 0; }
.title { font-size: 13px; font-weight: 600; color: #1f2d3d; }
.detail { font-size: 12px; color: #8a94a6; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { text-align: right; flex-shrink: 0; }
.time { font-size: 11px; color: #a8b0bd; margin-top: 4px; }
</style>
