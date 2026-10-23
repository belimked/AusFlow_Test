<template>
  <div class="layout-switcher">
    <span class="lbl">Layout preview</span>
    <el-radio-group :model-value="layoutKey" size="small" @update:model-value="setLayout">
      <el-radio-button v-for="l in LAYOUTS" :key="l.key" :value="l.key">{{ l.label }}</el-radio-button>
    </el-radio-group>
  </div>
</template>
<script setup>
import { LAYOUTS, layoutKey, setLayout } from './shell'
</script>
<style scoped>
.layout-switcher { position: fixed; right: 16px; bottom: 16px; z-index: 3000; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.96); border: 1px solid #e4e7ed; border-radius: 10px; padding: 6px 8px 6px 12px; box-shadow: 0 6px 24px rgba(15,23,42,.14); }
.lbl { font-size: 12px; color: #64748b; font-weight: 600; }
@media print { .layout-switcher { display: none; } }
</style>
