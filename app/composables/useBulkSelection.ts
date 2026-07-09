/**
 * Shared selection state for bulk action composables.
 * Each domain composable calls this and adds its own runAction on top.
 */
export function useBulkSelection() {
  const selectedIds = ref<string[]>([])
  const isRunning = ref(false)

  function isSelected(id: string): boolean {
    return selectedIds.value.includes(id)
  }

  function toggle(id: string) {
    selectedIds.value = isSelected(id)
      ? selectedIds.value.filter(x => x !== id)
      : [...selectedIds.value, id]
  }

  function selectAll(ids: string[]) {
    selectedIds.value = [...ids]
  }

  function clear() {
    selectedIds.value = []
  }

  return { selectedIds, isRunning, isSelected, toggle, selectAll, clear }
}
