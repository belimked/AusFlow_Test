<template>
  <div class="sev-chips">
    <span v-for="s in SEVERITIES" :key="s.key" class="chip" :class="{ on: modelValue === s.key }"
      :style="modelValue === s.key ? { background: s.color, borderColor: s.color, color: '#fff' } : { borderColor: s.color, color: s.color }"
      @click="emit('update:modelValue', modelValue === s.key ? '' : s.key)">
      {{ s.label }} {{ counts[s.key] || 0 }}
    </span>
  </div>
</template>
<script setup>
import { computed } from 'vue'

const props = defineProps({ items: Array, modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const SEVERITIES = [
  { key: 'critical', label: 'Critical', color: '#f56c6c' },
  { key: 'warning', label: 'Warning', color: '#e6a23c' },
  { key: 'info', label: 'Info', color: '#909399' }
]
const counts = computed(() => (props.items || []).reduce((m, a) => ((m[a.severity] = (m[a.severity] || 0) + 1), m), {}))
</script>
<style scoped>
.sev-chips { display: flex; gap: 6px; }
.chip { cursor: pointer; font-size: 12px; line-height: 1; padding: 5px 10px; border: 1px solid; border-radius: 12px; user-select: none; }
</style>
