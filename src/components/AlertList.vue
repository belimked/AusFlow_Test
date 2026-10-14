<template>
  <div class="alert-list">
    <div v-for="a in items" :key="a.id" class="alert" :class="[a.severity, { read: isRead(a) }]" @click="open(a)">
      <el-icon class="ico" :size="18"><component :is="ICONS[a.type]" /></el-icon>
      <div class="body">
        <div class="title">{{ a.title }}</div>
        <div class="detail"><span class="mono aid">{{ a.alertId }}</span> · {{ a.detail }}</div>
      </div>
      <div class="meta">
        <el-tag size="small" :type="TAG[a.severity]" effect="light">{{ ALERT_TYPES[a.type] }}</el-tag>
        <div class="time">
          <el-tag v-if="statusOf(a.alertId) !== 'open'" size="small" :type="statusOf(a.alertId) === 'resolved' ? 'success' : 'warning'" effect="plain" class="st">{{ ALERT_STATUS[statusOf(a.alertId)] }}</el-tag>
          <span v-if="noteCount(a)" class="notes"><el-icon><ChatDotSquare /></el-icon>{{ noteCount(a) }}</span>
          {{ ago(a.at) }}
        </div>
      </div>
    </div>
    <el-empty v-if="!items.length" description="No alerts" :image-size="60" />
  </div>
</template>
<script setup>
import { ALERT_TYPES, ALERT_STATUS, isRead, statusOf, notesOf, showAlert } from '../store/alerts'

defineProps({ items: Array })
const emit = defineEmits(['navigate'])
const TAG = { critical: 'danger', warning: 'warning', info: 'info' }
const ICONS = { overdue: 'AlarmClock', longJob: 'Timer', location: 'Location', capacity: 'Histogram', nolocation: 'Position', vehicleFull: 'Van', haulerBacklog: 'Briefcase', pendingDriver: 'User' }
const noteCount = (a) => notesOf(a.alertId).filter((n) => n.kind === 'note').length
function ago(s) {
  const m = Math.round((Date.now() - new Date(s).getTime()) / 6e4)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}
function open(a) {
  emit('navigate')
  showAlert(a)
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
.time { font-size: 11px; color: #a8b0bd; margin-top: 4px; display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.aid { color: #606f85; }
.notes { display: inline-flex; align-items: center; gap: 2px; color: #409eff; }
</style>
