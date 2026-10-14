<template>
  <div class="pager">
    <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
      :page-sizes="[10, 20, 50, 100]" layout="total, sizes, prev, pager, next, jumper" background />
  </div>
</template>
<script setup>
defineProps({ total: Number })
const page = defineModel('page')
const pageSize = defineModel('pageSize')
</script>
