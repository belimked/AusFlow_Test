<template>
  <div class="d-shell">
    <header class="d-top">
      <div class="brand" @click="go('/dashboard')">
        <span class="logo"><BrandLogo :size="26" /></span>
        <div><b>{{ BRAND.name }}</b><small>{{ BRAND.console.toUpperCase() }}</small></div>
      </div>
      <QuickJump width="300px" class="qj" />
      <div class="status-strip">
        <a class="stat" @click="go('/devices?overdue=1')"><i class="dot" :class="overdue ? 'amber' : 'green'" />Overdue devices<b class="mono">{{ overdue }}</b></a>
        <span class="sep" />
        <a class="stat" @click="go('/alerts')"><i class="dot" :class="critical ? 'rose' : 'green'" />Critical alerts<b class="mono">{{ critical }}</b></a>
        <span class="sep" />
        <span class="stat"><i class="dot green pulse" />Live sync</span>
      </div>
      <span class="spacer" />
      <HeaderActions />
    </header>
    <div class="d-body">
      <aside class="side">
        <div class="console-card">
          <el-icon :size="20" class="cc-icon"><Odometer /></el-icon>
          <div><b>Ops console</b><small>{{ activeDevices }} active devices</small></div>
          <span class="cc-chip mono">{{ compliance }}%</span>
        </div>
        <nav class="tree">
          <div v-for="g in nav" :key="g.key" class="grp" :class="{ cur: activeGroup?.key === g.key }">
            <button class="grp-head" @click="toggle(g.key)">
              <el-icon :size="18"><component :is="g.icon" /></el-icon>
              <span>{{ g.label }}</span>
              <el-icon class="chev" :class="{ open: open.has(g.key) }"><ArrowDown /></el-icon>
            </button>
            <div v-show="open.has(g.key)" class="leaves">
              <a v-for="i in g.items" :key="i.path" class="leaf" :class="{ on: i.path === active }" @click="go(i.path)">
                <el-icon class="leaf-icon"><component :is="i.icon" /></el-icon>
                <span>{{ i.label }}</span>
                <span v-if="i.badge && unreadCount" class="cnt mono">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
                <i v-else-if="i.path === active" class="on-dot" />
              </a>
            </div>
          </div>
        </nav>
        <div class="side-foot">
          <a class="foot-item" @click="go('/alerts')"><el-icon><Warning /></el-icon>Unread alerts<span class="mono pill rose">{{ unreadCount }}</span></a>
          <a class="foot-item" @click="go('/tickets')"><el-icon><Message /></el-icon>Ops tickets</a>
        </div>
      </aside>
      <main class="d-main">
        <div v-if="route.path !== '/dashboard'" class="d-head">
          <div class="crumbs">
            <span>{{ activeGroup?.label || 'Console' }}</span>
            <template v-if="activeItem && title !== activeItem.label"><el-icon><ArrowRight /></el-icon><a @click="go(activeItem.path)">{{ activeItem.label }}</a></template>
            <template v-if="route.params.id"><el-icon><ArrowRight /></el-icon><span class="crumb-cur">{{ title }}</span></template>
          </div>
          <h1 v-if="!route.params.id">{{ title }}</h1>
        </div>
        <router-view :key="route.fullPath" />
      </main>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import BrandLogo from '../components/BrandLogo.vue'
import { BRAND } from '../brand'
import { state, isOverdue } from '../store/db'
import { activeAlerts } from '../store/alerts'
import QuickJump from './QuickJump.vue'
import HeaderActions from './HeaderActions.vue'
import { useShell } from './shell'

const { route, nav, active, activeGroup, activeItem, title, unreadCount, go } = useShell()
const open = ref(new Set([activeGroup.value?.key || 'monitor']))
watch(activeGroup, (g) => { if (g && !open.value.has(g.key)) open.value = new Set([...open.value, g.key]) })
function toggle(k) {
  const s = new Set(open.value)
  s.has(k) ? s.delete(k) : s.add(k)
  open.value = s
}
const activeList = computed(() => state.devices.filter((d) => d.status === 'Active'))
const activeDevices = computed(() => activeList.value.length)
const overdue = computed(() => activeList.value.filter(isOverdue).length)
const compliance = computed(() => (activeDevices.value ? (100 - (overdue.value / activeDevices.value) * 100).toFixed(1) : '100.0'))
const critical = computed(() => activeAlerts.value.filter((a) => a.severity === 'critical').length)
</script>
<style scoped>
.d-shell { height: 100%; display: flex; flex-direction: column; }
.d-top { flex: none; height: 64px; display: flex; align-items: center; gap: 20px; padding: 0 24px 0 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }
.brand { display: flex; align-items: center; gap: 10px; width: 232px; flex: none; cursor: pointer; }
.logo { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(135deg, #e0f2fe, #cffafe); }
.brand b { display: block; font-family: var(--font-head); font-size: 16px; color: #0c4a6e; }
.brand small { font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em; color: #64748b; }
.qj :deep(.el-select__wrapper) { background: #f8fafc; }
.status-strip { display: flex; align-items: center; gap: 14px; height: 38px; padding: 0 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #475569; white-space: nowrap; }
.stat { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
.stat b { color: #0f172a; font-size: 13px; }
.sep { width: 1px; height: 18px; background: #e2e8f0; }
.dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.dot.green { background: #10b981; }
.dot.amber { background: #f59e0b; }
.dot.rose { background: #f43f5e; }
.pulse { box-shadow: 0 0 0 0 rgba(16, 185, 129, .5); animation: pulse 2s infinite; }
@keyframes pulse { 70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
.spacer { flex: 1; }
.d-body { flex: 1; min-height: 0; display: flex; }
.side { flex: none; width: 264px; background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 16px 14px 12px; box-sizing: border-box; overflow-y: auto; }
.console-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 18px; }
.cc-icon { color: #0369a1; }
.console-card b { display: block; white-space: nowrap; font-size: 13px; color: #0f172a; }
.console-card small { font-size: 11px; color: #0369a1; }
.cc-chip { margin-left: auto; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.grp { margin-bottom: 2px; }
.grp-head { width: 100%; display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 10px; border: 0; background: none; color: #334155; font-size: 14px; cursor: pointer; border-radius: 6px; font-family: inherit; }
.grp-head:hover { background: #f8fafc; }
.grp.cur .grp-head { color: #0369a1; font-weight: 600; }
.chev { margin-left: auto; color: #94a3b8; transition: transform .15s; transform: rotate(-90deg); }
.chev.open { transform: none; }
.leaves { margin: 2px 0 8px 19px; padding-left: 12px; border-left: 1px solid #e2e8f0; }
.leaf { position: relative; display: flex; align-items: center; height: 34px; padding: 0 10px; border-radius: 4px; color: #475569; font-size: 13.5px; cursor: pointer; }
.leaf:hover { background: #f8fafc; color: #0f172a; }
.leaf.on { background: #f0f9ff; color: #0369a1; font-weight: 600; }
.leaf-icon { flex: none; margin-right: 8px; font-size: 15px; color: #94a3b8; }
.leaf:hover .leaf-icon { color: #475569; }
.leaf.on .leaf-icon { color: #0369a1; }
.leaf.on::before { content: ''; position: absolute; left: -14px; top: 7px; bottom: 7px; width: 3px; border-radius: 3px; background: #0284c7; }
.on-dot { margin-left: auto; width: 6px; height: 6px; border-radius: 50%; background: #0369a1; }
.cnt { margin-left: auto; font-size: 11px; padding: 0 6px; line-height: 18px; border-radius: 4px; background: #ffe4e6; color: #9f1239; }
.side-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 2px; }
.foot-item { display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px; border-radius: 6px; font-size: 13px; color: #334155; cursor: pointer; }
.foot-item:hover { background: #f8fafc; }
.pill { margin-left: auto; font-size: 11px; padding: 0 6px; line-height: 18px; border-radius: 4px; }
.pill.rose { background: #ffe4e6; color: #9f1239; }
.d-main { flex: 1; min-width: 0; overflow-y: auto; }
.d-main > .dash { padding-top: 24px; }
.d-head { padding: 20px 32px 12px; }
.crumbs { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #64748b; }
.crumbs a { color: #0369a1; cursor: pointer; }
.crumb-cur { color: #0f172a; }
h1 { margin: 4px 0 0; font-family: var(--font-head); font-size: 22px; line-height: 28px; font-weight: 600; letter-spacing: -.01em; color: #0f172a; }
</style>
