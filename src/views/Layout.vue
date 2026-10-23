<template>
  <component :is="LAYOUT_COMPONENTS[layoutKey]" />
  <AlertDialog />
  <LayoutSwitcher />
</template>
<script setup>
import { watchEffect } from 'vue'
import AlertDialog from '../components/AlertDialog.vue'
import LayoutSwitcher from '../layouts/LayoutSwitcher.vue'
import LayoutClassic from '../layouts/LayoutClassic.vue'
import LayoutHarbour from '../layouts/LayoutHarbour.vue'
import LayoutRail from '../layouts/LayoutRail.vue'
import LayoutCalm from '../layouts/LayoutCalm.vue'
import { layoutKey } from '../layouts/shell'
import '../layouts/themes.css'

const LAYOUT_COMPONENTS = { classic: LayoutClassic, harbour: LayoutHarbour, rail: LayoutRail, calm: LayoutCalm }
// Theme variables live on <html> so teleported dialogs and popovers pick them up too.
watchEffect(() => { document.documentElement.dataset.layout = layoutKey.value })
</script>
