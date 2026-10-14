import { ref, computed, watch } from 'vue'

export function usePaged(source, size = 20, sortValues = {}) {
  const page = ref(1)
  const pageSize = ref(size)
  const sort = ref({ prop: '', order: null })
  const sorted = computed(() => {
    const { prop, order } = sort.value
    if (!prop || !order) return source.value
    const value = (row) => sortValues[prop] ? sortValues[prop](row) : prop.split('.').reduce((v, key) => v?.[key], row)
    return [...source.value].sort((a, b) => {
      const x = value(a), y = value(b)
      if (x == null || x === '') return y == null || y === '' ? 0 : 1
      if (y == null || y === '') return -1
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })
      return order === 'ascending' ? cmp : -cmp
    })
  })
  const rows = computed(() => sorted.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
  watch([() => source.value.length, pageSize], () => { if ((page.value - 1) * pageSize.value >= source.value.length) page.value = 1 })
  const onSort = ({ prop, order }) => { sort.value = { prop, order }; page.value = 1 }
  return { page, pageSize, rows, sorted, onSort, total: computed(() => source.value.length) }
}
