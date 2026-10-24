<template>
  <div class="c-shell">
    <aside class="side">
      <div class="brand" @click="go('/dashboard')">
        <BrandLogo :size="36" />
        <div><b>{{ BRAND.name }}</b><small>{{ BRAND.console }}</small></div>
      </div>
      <QuickJump width="100%" class="qj" />
      <nav class="sections">
        <section v-for="g in nav" :key="g.key">
          <h6>{{ g.label }}</h6>
          <a v-for="i in g.items" :key="i.path" class="item" :class="{ on: i.path === active }" @click="go(i.path)">
            <el-icon><component :is="i.icon" /></el-icon><span>{{ i.label }}</span>
            <span v-if="i.badge && unreadCount" class="cnt">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </a>
        </section>
      </nav>
    </aside>
    <main class="c-main">
      <header class="c-head">
        <div>
          <div class="crumbs">
            <span>{{ activeGroup?.label || 'Console' }}</span>
            <template v-if="activeItem && title !== activeItem.label"><span>/</span><a @click="go(activeItem.path)">{{ activeItem.label }}</a></template>
          </div>
          <h1>{{ title }}</h1>
        </div>
        <HeaderActions />
      </header>
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
.c-shell { height: 100%; display: flex; }
.side { flex: none; width: 248px; background: #fff; border-right: 1px solid #e9eef3; display: flex; flex-direction: column; padding: 18px 14px; box-sizing: border-box; overflow-y: auto; }
.brand { display: flex; align-items: center; gap: 10px; padding: 0 6px 18px; cursor: pointer; }
.brand b { display: block; font-size: 15px; color: #0c2a3e; }
.brand small { font-size: 12px; color: #7b8ba0; }
.qj { margin-bottom: 14px; }
.qj :deep(.el-select__wrapper) { background: #f3f6f9; box-shadow: none; border-radius: 10px; }
.sections section { margin-bottom: 14px; }
h6 { margin: 0 0 4px; padding: 0 12px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .08em; }
.item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; color: #3b4a5c; font-size: 14px; cursor: pointer; }
.item:hover { background: #f3f6f9; }
.item.on { background: #e6f0f6; color: #025481; font-weight: 600; }
.item.on .el-icon { color: #0369a1; }
.cnt { margin-left: auto; background: #e11d48; color: #fff; border-radius: 9px; font-size: 11px; line-height: 17px; padding: 0 6px; }
.c-main { flex: 1; min-width: 0; overflow-y: auto; }
.c-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 22px 32px 16px; }
.crumbs { display: flex; gap: 6px; font-size: 13px; color: #8696aa; }
.crumbs a { color: #0369a1; cursor: pointer; }
h1 { margin: 4px 0 0; font-size: 26px; font-weight: 700; color: #0c2a3e; letter-spacing: -.01em; }
</style>
