<template>
  <div class="qr">
    <template v-if="value">
      <img :src="url" :width="size" :height="size" alt="QR" />
      <div class="mono">{{ value }}</div>
      <div class="no-print">
        <el-button size="small" :icon="'Printer'" @click="print">Print QR code</el-button>
        <el-button v-if="editable" size="small" :icon="'Edit'" @click="edit">Edit QR</el-button>
      </div>
    </template>
    <template v-else>
      <div class="muted">No QR code set<span v-if="systemRef" class="mono" title="No QR – system ID"> · {{ systemRef }}</span></div>
      <el-button v-if="editable" class="no-print" size="small" type="primary" :icon="'Plus'" @click="edit">Set QR</el-button>
    </template>
  </div>
</template>
<script setup>
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'
import { ElMessageBox } from 'element-plus'
import { BRAND } from '../brand'

const props = defineProps({
  value: String, systemRef: String, title: String, subtitle: String, size: { type: Number, default: 160 },
  editable: Boolean, prefix: { type: String, default: '' }, validate: Function
})
const emit = defineEmits(['change'])
const genCode = () => props.prefix + Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')

async function edit() {
  let input
  try {
    ({ value: input } = await ElMessageBox.prompt('Enter the code printed on the QR label.', props.value ? 'Edit QR code' : 'Set QR code', {
      inputValue: props.value || genCode(),
      inputValidator: (v) => {
        const s = (v || '').trim()
        if (!s) return 'QR code is required'
        if (/\s/.test(s)) return 'QR code cannot contain spaces'
        return s === props.value || !props.validate ? true : props.validate(s) || true
      }
    }))
  } catch { return }
  const s = input.trim()
  if (s !== props.value) emit('change', s)
}
const url = ref('')
watchEffect(async () => {
  url.value = props.value ? await QRCode.toDataURL(props.value, { width: 480, margin: 1 }) : ''
})

function print() {
  const w = window.open('', '_blank', 'width=480,height=640')
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  w.document.write(`<html><head><title>${esc(props.title)}</title><style>
    body{font-family:sans-serif;text-align:center;padding:24px}
    .box{border:2px solid #000;border-radius:8px;display:inline-block;padding:16px 24px}
    h2{margin:0 0 4px;font-size:20px} p{margin:2px 0;color:#333} img{width:280px;height:280px}
    .code{font-family:monospace;font-size:18px;letter-spacing:2px}
  </style></head><body><div class="box"><h2>${esc(props.title)}</h2><p>${esc(props.subtitle)}</p>
    <img src="${url.value}"/><p class="code">${esc(props.value)}</p><p style="font-size:12px">${esc(BRAND.name)}</p></div>
    <script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close()
}
</script>
<style scoped>
.qr { display: inline-flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px; border: 1px dashed #dcdfe6; border-radius: 6px; }
</style>
