<template>
  <div class="hdr-actions">
    <el-tag type="warning" effect="plain" round>Prototype · shared demo data</el-tag>
    <el-tag v-if="!can('write')" type="info" effect="plain" round>Read-only</el-tag>
    <el-tooltip v-if="can('admin')" content="Reset demo data"><el-button circle :icon="'RefreshLeft'" @click="reset" /></el-tooltip>
    <AlertBell />
    <el-dropdown @command="logout">
      <span class="hdr-user">
        <span class="avatar">{{ initials }}</span>
        <span v-if="!compact" class="who"><b>{{ user }}</b><small>{{ ROLE_LABELS[roleOf()] }}</small></span>
        <el-icon><ArrowDown /></el-icon>
      </span>
      <template #dropdown><el-dropdown-menu><el-dropdown-item command="logout">Sign out</el-dropdown-item></el-dropdown-menu></template>
    </el-dropdown>
  </div>
</template>
<script setup>
import { currentUser, can, roleOf, ROLE_LABELS } from '../store/api'
import AlertBell from '../components/AlertBell.vue'
import { useShell } from './shell'

defineProps({ compact: Boolean })
const { reset, logout } = useShell()
const user = currentUser()?.username || ''
const initials = user.slice(0, 2).toUpperCase()
</script>
<style scoped>
.hdr-actions { display: flex; align-items: center; gap: 12px; }
.hdr-user { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; outline: none; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--el-color-primary-light-8); color: var(--el-color-primary-dark-2); display: grid; place-items: center; font-size: 12px; font-weight: 700; }
.who { display: flex; flex-direction: column; line-height: 1.2; }
.who b { font-size: 13px; }
.who small { font-size: 11px; color: #8a94a6; }
</style>
