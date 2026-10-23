<template>
  <div class="h-shell">
    <header class="h-top">
      <div class="brand" @click="go('/dashboard')"><BrandLogo :size="30" /><span>{{ BRAND.name }}</span></div>
      <nav class="groups">
        <el-dropdown v-for="g in nav" :key="g.key" trigger="hover" :show-timeout="80" placement="bottom-start" @command="go">
          <span class="group" :class="{ on: activeGroup?.key === g.key }" @click="go(g.items[0].path)">
            <el-icon><component :is="g.icon" /></el-icon>{{ g.label }}
            <span v-if="g.items.some((i) => i.badge) && unreadCount" class="dot">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="i in g.items" :key="i.path" :command="i.path" :icon="i.icon">{{ i.label }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </nav>
      <span class="spacer" />
      <QuickJump width="220px" class="qj" />
    </header>
    <div class="h-sub">
      <div class="tabs">
        <span class="crumb">{{ activeGroup?.label || 'Console' }}</span>
        <template v-if="activeGroup">
          <a v-for="i in activeGroup.items" :key="i.path" class="tab" :class="{ on: i.path === active }" @click="go(i.path)">
            {{ i.label }}<span v-if="i.badge && unreadCount" class="cnt">{{ unreadCount }}</span>
          </a>
        </template>
        <span v-if="!activeItem" class="tab on">{{ title }}</span>
      </div>
      <HeaderActions />
    </div>
    <main class="h-main">
      <div v-if="title !== activeItem?.label" class="h-title">{{ title }}</div>
      <router-view :key="route.fullPath" />
    </main>
  </div>
</template>
<script setup>
import BrandLogo from '../components/BrandLogo.vue'
import { BRAND } from '../brand'
import QuickJump from './QuickJump.vue'
import HeaderActions from './HeaderActions.vue'
import { useShell } from './shell'

const { route, nav, active, activeGroup, activeItem, title, unreadCount, go } = useShell()
</script>
<style scoped>
.h-shell { height: 100%; display: flex; flex-direction: column; }
.h-top { flex: none; height: 56px; display: flex; align-items: center; gap: 28px; padding: 0 24px; background: linear-gradient(90deg, #0b4f4a, #0f766e); color: #fff; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; cursor: pointer; white-space: nowrap; }
.groups { display: flex; gap: 4px; height: 100%; }
.groups :deep(.el-dropdown) { height: 100%; color: inherit; }
.group { display: inline-flex; align-items: center; gap: 6px; height: 100%; padding: 0 14px; color: #d5ece9; cursor: pointer; font-size: 14px; border-bottom: 3px solid transparent; box-sizing: border-box; outline: none; }
.group:hover { color: #fff; background: rgba(255, 255, 255, .08); }
.group.on { color: #fff; font-weight: 600; border-bottom-color: #5eead4; }
.dot { background: #f97316; color: #fff; border-radius: 9px; font-size: 11px; line-height: 17px; padding: 0 6px; }
.spacer { flex: 1; }
.qj :deep(.el-select__wrapper) { background: rgba(255, 255, 255, .14); box-shadow: none; }
.qj :deep(.el-select__placeholder), .qj :deep(.el-select__prefix) { color: #cde9e5; }
.h-sub { flex: none; height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: #fff; border-bottom: 1px solid #e3eae8; }
.tabs { display: flex; align-items: center; gap: 4px; height: 100%; }
.crumb { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #8aa19d; font-weight: 700; margin-right: 12px; }
.tab { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; color: #475569; cursor: pointer; font-size: 14px; }
.tab:hover { background: #eef5f4; }
.tab.on { background: #0f766e; color: #fff; font-weight: 600; }
.cnt { background: #f97316; color: #fff; border-radius: 9px; font-size: 11px; line-height: 16px; padding: 0 6px; }
.h-main { flex: 1; overflow-y: auto; }
.h-title { padding: 18px 28px 0; font-size: 20px; font-weight: 700; color: #12302c; }
</style>
