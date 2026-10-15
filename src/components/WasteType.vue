<template><span><el-tag v-if="wasteCodeOf(text)" size="small" style="margin-right: 5px">{{ wasteCodeOf(text) }}</el-tag>{{ text || '—' }}</span></template>
<script setup>
import { wasteCodeOf } from '../store/wasteCodes'
defineProps({ text: String })
</script>
