<template>
  <el-container style="height: 100%">
    <el-aside width="208px" class="aside">
      <div class="brand"><BrandLogo :size="34" /><div>{{ BRAND.name }}<small>{{ BRAND.console }}</small></div></div>
      <el-menu router :default-active="active" background-color="#1d2b3a" text-color="#c7d1dc" active-text-color="#fff" unique-opened>
        <el-menu-item index="/dashboard"><el-icon><House /></el-icon>Dashboard</el-menu-item>
        <el-menu-item index="/alerts"><el-icon><Bell /></el-icon>Alerts
          <span v-if="unreadCount" class="menu-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span></el-menu-item>
        <el-menu-item index="/locations"><el-icon><Location /></el-icon>Locations</el-menu-item>
        <el-sub-menu index="dev">
          <template #title><el-icon><Box /></el-icon>Devices</template>
          <el-menu-item index="/devices">Device List</el-menu-item>
          <el-menu-item index="/import">CSV Import</el-menu-item>
          <el-menu-item index="/change-logs">Change Log</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="co">
          <template #title><el-icon><Van /></el-icon>Haulers</template>
          <el-menu-item index="/companies">Haulers</el-menu-item>
          <el-menu-item index="/drivers">Drivers</el-menu-item>
          <el-menu-item index="/vehicles">Vehicles</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="ops">
          <template #title><el-icon><Tickets /></el-icon>Operations</template>
          <el-menu-item index="/pickups">Pump-outs</el-menu-item>
          <el-menu-item index="/transfers">Transfers</el-menu-item>
          <el-menu-item index="/unloads">Unloads</el-menu-item>
          <el-menu-item index="/trace">Waste Tracking</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/facilities"><el-icon><OfficeBuilding /></el-icon>Facilities</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="title">{{ route.meta.title }}</span>
        <span class="spacer" />
        <el-tag type="warning" effect="plain">Prototype · shared demo data</el-tag>
        <AlertBell />
        <el-button size="small" :icon="'RefreshLeft'" @click="reset">Reset demo data</el-button>
        <el-dropdown @command="logout">
          <span class="user"><el-icon><User /></el-icon>{{ user }}</span>
          <template #dropdown><el-dropdown-menu><el-dropdown-item command="logout">Sign out</el-dropdown-item></el-dropdown-menu></template>
        </el-dropdown>
      </el-header>
      <el-main style="padding: 0">
        <router-view :key="route.fullPath" />
      </el-main>
    </el-container>
  </el-container>
</template>
<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { resetDemo } from '../store/db'
import { currentUser, logout as signOut } from '../store/api'
import { unreadCount } from '../store/alerts'
import AlertBell from '../components/AlertBell.vue'
import BrandLogo from '../components/BrandLogo.vue'
import { BRAND } from '../brand'

const route = useRoute()
const router = useRouter()
const user = currentUser()?.username
const active = computed(() => {
  const p = route.path
  const map = { '/locations/': '/locations', '/devices/': '/devices', '/companies/': '/companies', '/vehicles/': '/vehicles', '/pickups/': '/pickups', '/facilities/': '/facilities' }
  for (const [k, v] of Object.entries(map)) if (p.startsWith(k)) return v
  return p
})

async function reset() {
  await ElMessageBox.confirm('This will clear all changes, imports and new records and restore the original demo data.', 'Reset demo data', { type: 'warning' })
  await resetDemo()
  ElMessage.success('Demo data reset')
  router.push('/dashboard')
}
function logout() {
  signOut()
  router.push('/login')
}
</script>
<style scoped>
.aside { background: #1d2b3a; overflow-y: auto; }
.aside .el-menu { border-right: none; }
.brand { display: flex; align-items: center; gap: 8px; color: #fff; font-size: 15px; font-weight: 700; padding: 16px 14px; white-space: nowrap; }
.brand small { display: block; font-size: 12px; font-weight: 400; color: #9fb0c2; margin-top: 2px; letter-spacing: 0; }
.header { background: #fff; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e6e8eb; height: 52px; }
.title { font-size: 16px; font-weight: 600; }
.spacer { flex: 1; }
.user { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.menu-badge { margin-left: auto; background: #f56c6c; color: #fff; border-radius: 10px; font-size: 11px; line-height: 18px; padding: 0 7px; }
</style>
