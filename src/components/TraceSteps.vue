<template>
  <el-steps direction="vertical" :active="trace.hops.length" finish-status="success" :space="56">
    <el-step v-for="(h, i) in trace.hops" :key="i" :title="title(h)" :description="desc(h)" />
    <el-step v-if="!trace.finished" title="Still on board" :description="`Currently on vehicle ${plateOf(last.vehicleId)}, not yet unloaded`" status="wait" />
  </el-steps>
</template>
<script setup>
import { computed } from 'vue'
import { traceForward, nameOf, plateOf, fmtTime, fmtL } from '../store/db'

const props = defineProps({ pickup: Object })
const trace = computed(() => traceForward(props.pickup))
const last = computed(() => trace.value.hops[trace.value.hops.length - 1])
const title = (h) => ({
  pickup: `Pump-out → vehicle ${plateOf(h.vehicleId)}`,
  transfer: `Transfer → vehicle ${plateOf(h.vehicleId)}`,
  unload: `Unload → ${nameOf('facilities', h.ref.facilityId)}`
})[h.kind]
const desc = (h) => `${fmtTime(h.at)} · ${h.ref.id}` + (h.kind === 'pickup' ? ` · ${fmtL(h.ref.volume)}` : ` · full load ${fmtL(h.ref.volume)}`)
</script>
