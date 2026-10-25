<template>
  <component :is="LAYOUT_COMPONENTS[layoutKey]" />
  <AlertDialog />
</template>
<script setup>
import { watchEffect } from 'vue'
import AlertDialog from '../components/AlertDialog.vue'
import LayoutClassic from '../layouts/LayoutClassic.vue'
import LayoutHarbour from '../layouts/LayoutHarbour.vue'
import LayoutRail from '../layouts/LayoutRail.vue'
import LayoutCalm from '../layouts/LayoutCalm.vue'
import LayoutHydro from '../layouts/LayoutHydro.vue'
import { layoutKey } from '../layouts/shell'
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/jetbrains-mono'
import '../layouts/themes.css'

const LAYOUT_COMPONENTS = { classic: LayoutClassic, harbour: LayoutHarbour, rail: LayoutRail, calm: LayoutCalm, hydro: LayoutHydro }
// Theme variables live on <html> so teleported dialogs and popovers pick them up too.
watchEffect(() => { document.documentElement.dataset.layout = layoutKey.value })
</script>
