import { ref, computed, watch } from 'vue'

export function usePaged(source, size = 20) {
  const page = ref(1)
  const pageSize = ref(size)
  const rows = computed(() => source.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
  watch(() => source.value.length, () => { if ((page.value - 1) * pageSize.value >= source.value.length) page.value = 1 })
  return { page, pageSize, rows, total: computed(() => source.value.length) }
}
