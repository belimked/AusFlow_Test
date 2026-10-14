<template>
  <div class="photos" v-loading="loading">
    <section v-for="(label, kind) in kinds" :key="kind">
      <div class="head">
        <b>{{ label }}</b><span class="muted">({{ byKind(kind).length }})</span>
        <span style="flex: 1" />
        <el-button size="small" :icon="'Upload'" :loading="uploading === kind" @click="pick(kind)">Upload</el-button>
      </div>
      <div v-if="byKind(kind).length" class="grid">
        <div v-for="(p, i) in byKind(kind)" :key="p.id" class="thumb">
          <el-image :src="p.dataUrl" fit="cover" :preview-src-list="byKind(kind).map((x) => x.dataUrl)" :initial-index="i" preview-teleported hide-on-click-modal />
          <el-icon class="del" title="Delete photo" @click="remove(p)"><Delete /></el-icon>
          <div class="meta" :title="`${p.name} · ${p.user} · ${fmtTime(p.at)}`">{{ fmtDate(p.at) }}</div>
        </div>
      </div>
      <div v-else class="empty muted">No {{ label.toLowerCase() }} yet</div>
    </section>
    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden @change="upload" />
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../store/api'
import { fmtDate, fmtTime } from '../store/db'

// type: 'device' | 'company' | 'vehicle' | 'driver'; kinds: { kindKey: label }, must match the server's PHOTO_KINDS
const props = defineProps({
  type: { type: String, required: true },
  id: { type: String, required: true },
  kinds: { type: Object, default: () => ({ photo: 'Photos & attachments' }) }
})
const emit = defineEmits(['added', 'removed', 'count'])
const MAX_SIDE = 1600

const photos = ref([])
const loading = ref(true)
const uploading = ref('')
const fileInput = ref()
let pendingKind = ''

const byKind = (kind) => photos.value.filter((p) => p.kind === kind)
const query = () => `/photos?type=${encodeURIComponent(props.type)}&id=${encodeURIComponent(props.id)}`

onMounted(async () => {
  try {
    photos.value = await api(query())
    emit('count', photos.value.length)
  } finally {
    loading.value = false
  }
})

function pick(kind) {
  pendingKind = kind
  fileInput.value.value = ''
  fileInput.value.click()
}

async function shrink(file) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * k)
  canvas.height = Math.round(bmp.height * k)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}

async function upload(e) {
  const kind = pendingKind
  const files = [...e.target.files]
  if (!files.length) return
  uploading.value = kind
  try {
    for (const file of files) {
      const row = await api('/photos', { type: props.type, id: props.id, kind, name: file.name, dataUrl: await shrink(file) })
      photos.value.unshift(row)
      emit('added', kind, file.name)
    }
    emit('count', photos.value.length)
    ElMessage.success(`${files.length} photo(s) uploaded`)
  } catch (err) {
    ElMessage.error('Upload failed: ' + err.message)
  } finally {
    uploading.value = ''
  }
}

async function remove(p) {
  try { await ElMessageBox.confirm(`Delete photo "${p.name}"?`, 'Delete photo', { type: 'warning' }) } catch { return }
  await api('/photos/' + p.id, null, 'DELETE')
  photos.value = photos.value.filter((x) => x.id !== p.id)
  emit('removed', p.kind, p.name)
  emit('count', photos.value.length)
  ElMessage.success('Photo deleted')
}
</script>
<style scoped>
.photos section + section { margin-top: 14px; }
.head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.thumb { position: relative; border-radius: 6px; overflow: hidden; background: #f2f3f5; }
.thumb .el-image { width: 100%; aspect-ratio: 1; display: block; }
.thumb .del { position: absolute; top: 4px; right: 4px; padding: 3px; border-radius: 4px; background: rgba(0,0,0,.55); color: #fff; cursor: pointer; opacity: .75; transition: opacity .15s; }
.thumb:hover .del { opacity: 1; }
.thumb .meta { font-size: 11px; color: #909399; padding: 2px 4px; }
.empty { font-size: 12px; padding: 14px; text-align: center; border: 1px dashed #dcdfe6; border-radius: 6px; }
</style>
