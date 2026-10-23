<template>
  <div class="r-shell">
    <aside class="rail">
      <div class="logo" @click="go('/dashboard')"><BrandLogo :size="34" /></div>
      <button v-for="g in nav" :key="g.key" class="rail-btn" :class="{ on: openKey === g.key, cur: activeGroup?.key === g.key }" @click="toggle(g)">
        <el-icon :size="20"><component :is="g.icon" /></el-icon>
        <span>{{ g.label }}</span>
        <i v-if="g.items.some((i) => i.badge) && unreadCount" class="pip" />
      </button>
    </aside>
    <aside v-if="panelGroup" class="panel">
      <div class="panel-head">
        <div><small>{{ BRAND.name }}</small><b>{{ panelGroup.label }}</b></div>
        <el-tooltip content="Hide menu"><el-button text circle :icon="'Fold'" @click="openKey = null" /></el-tooltip>
      </div>
      <a v-for="i in panelGroup.items" :key="i.path" class="p-item" :class="{ on: i.path === active }" @click="go(i.path)">
        <el-icon><component :is="i.icon" /></el-icon>{{ i.label }}
        <span v-if="i.badge && unreadCount" class="cnt">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </a>
    </aside>
    <div class="r-body">
      <header class="r-top">
        <el-button v-if="!panelGroup" text circle :icon="'Expand'" @click="openKey = activeGroup?.key || nav[0].key" />
        <div class="crumbs">
          <span class="muted">{{ activeGroup?.label }}</span>
          <template v-if="activeItem && title !== activeItem.label">
            <el-icon class="muted"><ArrowRight /></el-icon><a class="crumb-link" @click="go(activeItem.path)">{{ activeItem.label }}</a>
          </template>
          <el-icon v-if="activeGroup" class="muted"><ArrowRight /></el-icon><b>{{ title }}</b>
        </div>
        <span class="spacer" />
        <QuickJump width="260px" />
        <HeaderActions compact />
      </header>
      <main class="r-main"><router-view :key="route.fullPath" /></main>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import BrandLogo from '../components/BrandLogo.vue'
import { BRAND } from '../brand'
import QuickJump from './QuickJump.vue'
import HeaderActions from './HeaderActions.vue'
import { useShell } from './shell'

const { route, nav, active, activeGroup, activeItem, title, unreadCount, go } = useShell()
const openKey = ref(activeGroup.value?.key || 'monitor')
const panelGroup = computed(() => nav.value.find((g) => g.key === openKey.value))
watch(activeGroup, (g) => { if (g && openKey.value) openKey.value = g.key })
function toggle(g) {
  if (openKey.value === g.key) openKey.value = null
  else openKey.value = g.key
}
</script>
<style scoped>
.r-shell { height: 100%; display: flex; }
.rail { flex: none; width: 76px; background: #111827; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 0; }
.logo { margin-bottom: 14px; cursor: pointer; }
.rail-btn { position: relative; width: 62px; padding: 9px 0 7px; border: 0; border-radius: 12px; background: transparent; color: #9ca3af; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; cursor: pointer; }
.rail-btn:hover { background: #1f2937; color: #e5e7eb; }
.rail-btn.cur { color: #fff; }
.rail-btn.on { background: #4f46e5; color: #fff; }
.pip { position: absolute; top: 7px; right: 14px; width: 8px; height: 8px; border-radius: 50%; background: #f43f5e; box-shadow: 0 0 0 2px #111827; }
.panel { flex: none; width: 220px; background: #fff; border-right: 1px solid #e8eaf1; padding: 14px 10px; display: flex; flex-direction: column; gap: 2px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; padding: 2px 6px 14px; }
.panel-head small { display: block; font-size: 11px; color: #94a3b8; }
.panel-head b { font-size: 17px; color: #0f172a; }
.p-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; color: #334155; cursor: pointer; font-size: 14px; }
.p-item:hover { background: #f4f5fb; }
.p-item.on { background: #ededfc; color: #4338ca; font-weight: 600; }
.cnt { margin-left: auto; background: #f43f5e; color: #fff; border-radius: 9px; font-size: 11px; line-height: 17px; padding: 0 6px; }
.r-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.r-top { flex: none; height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 20px; background: #fff; border-bottom: 1px solid #e8eaf1; }
.crumbs { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.crumb-link { color: #4f46e5; cursor: pointer; }
.spacer { flex: 1; }
.r-main { flex: 1; overflow-y: auto; }
</style>
