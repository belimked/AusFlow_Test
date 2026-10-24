<template>
  <el-select ref="sel" v-model="pickVal" filterable placeholder="Jump to…  (Ctrl K)" :prefix-icon="'Search'" class="quick-jump" :style="{ width }" @change="jump">
    <el-option-group v-for="g in nav" :key="g.key" :label="g.label">
      <el-option v-for="i in g.items" :key="i.path" :label="i.label" :value="i.path" />
    </el-option-group>
  </el-select>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useShell } from './shell'

defineProps({ width: { type: String, default: '240px' } })
const { nav, go } = useShell()
const sel = ref(), pickVal = ref('')
function jump(p) { go(p); pickVal.value = ''; sel.value?.blur() }
function onKey(e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); sel.value?.focus() } }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
