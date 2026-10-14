<template>
  <div v-if="tags.length" class="tag-ids" :class="{ inline }">
    <el-tag v-for="t in tags" :key="t" :size="inline ? 'default' : 'small'" effect="plain" class="mono">{{ t }}</el-tag>
  </div>
  <span v-else class="muted">—</span>
</template>
<script setup>
import { computed } from 'vue'
import { tagsOf } from '../store/db'

const props = defineProps({ device: { type: Object, required: true }, inline: Boolean })
const tags = computed(() => tagsOf(props.device))
</script>
<style scoped>
.tag-ids { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.tag-ids.inline { flex-direction: row; flex-wrap: wrap; gap: 6px; }
</style>
