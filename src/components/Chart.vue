<template>
  <VChart :option="option" autoresize :style="{ height: height + 'px' }" @click="(e) => emit('click', e)" />
</template>
<script setup>
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart, GaugeChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, BarChart, LineChart, PieChart, GaugeChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])
defineProps({ option: Object, height: { type: Number, default: 280 } })
const emit = defineEmits(['click'])
</script>
