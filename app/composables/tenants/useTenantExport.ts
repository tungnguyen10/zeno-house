import { computed, ref } from 'vue'
import type { Building } from '~/types/buildings'
import type { TenantExportCandidate } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'
import { useExportDownload } from '../useExportDownload'

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim()
}

export function useTenantExport() {
  const buildingId = ref('')
  const buildingOptions = ref<Array<{ value: string; label: string }>>([])
  const candidates = ref<TenantExportCandidate[]>([])
  const selectedIds = ref<string[]>([])
  const search = ref('')
  const loadingBuildings = ref(false)
  const loadingCandidates = ref(false)
  const exporting = ref(false)
  const error = ref<string | null>(null)
  let requestVersion = 0

  const filteredCandidates = computed(() => {
    const q = normalizeSearch(search.value)
    if (!q) return candidates.value
    return candidates.value.filter(row => normalizeSearch([row.fullName, row.code, row.phone, ...row.roomNumbers].join(' ')).includes(q))
  })

  const allFilteredSelected = computed(() => filteredCandidates.value.length > 0
    && filteredCandidates.value.every(row => selectedIds.value.includes(row.id)))

  async function loadBuildings() {
    loadingBuildings.value = true
    error.value = null
    buildingOptions.value = []
    try {
      const options: Array<{ value: string; label: string }> = []
      for (let page = 1; ; page++) {
        const response = await $fetch<ApiSuccess<Building[]> & { meta: { totalPages: number } }>('/api/buildings', {
          query: { page, limit: 100, sort: 'name' },
        })
        options.push(...response.data.map(row => ({ value: row.id, label: row.name })))
        if (page >= response.meta.totalPages) break
      }
      buildingOptions.value = options
    }
    catch (cause) {
      error.value = getApiErrorMessage(cause, 'Không thể tải danh sách tòa nhà.')
    }
    finally {
      loadingBuildings.value = false
    }
  }

  async function changeBuilding(id: string) {
    const version = ++requestVersion
    buildingId.value = id
    candidates.value = []
    selectedIds.value = []
    search.value = ''
    error.value = null
    loadingCandidates.value = false
    if (!id) return
    loadingCandidates.value = true
    try {
      const response = await $fetch<ApiSuccess<TenantExportCandidate[]>>('/api/tenants/export-candidates', {
        query: { building_id: id },
      })
      if (version === requestVersion) candidates.value = response.data
    }
    catch (cause) {
      if (version === requestVersion) error.value = getApiErrorMessage(cause, 'Không thể tải khách đang ở tòa nhà.')
    }
    finally {
      if (version === requestVersion) loadingCandidates.value = false
    }
  }

  function toggleSelected(id: string) {
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter(value => value !== id)
      : [...selectedIds.value, id]
  }

  function toggleAllFiltered() {
    const ids = new Set(filteredCandidates.value.map(row => row.id))
    selectedIds.value = allFilteredSelected.value
      ? selectedIds.value.filter(id => !ids.has(id))
      : [...new Set([...selectedIds.value, ...ids])]
  }

  async function exportSelected(): Promise<boolean> {
    if (!buildingId.value || selectedIds.value.length === 0) return false
    exporting.value = true
    error.value = null
    try {
      await useExportDownload().downloadBlob('/api/tenants/export', 'tenants.xlsx', {
        method: 'POST', body: { building_id: buildingId.value, tenant_ids: selectedIds.value },
      })
      return true
    }
    catch (cause) {
      const message = getApiErrorMessage(cause, 'Không thể xuất Excel. Vui lòng thử lại.')
      if (getApiErrorDetails<{ reason?: string }>(cause)?.reason === 'TENANT_EXPORT_SELECTION_STALE') {
        await changeBuilding(buildingId.value)
      }
      error.value = message
      return false
    }
    finally {
      exporting.value = false
    }
  }

  function reset() {
    requestVersion++
    buildingId.value = ''
    candidates.value = []
    selectedIds.value = []
    search.value = ''
    error.value = null
    loadingCandidates.value = false
  }

  return {
    buildingId, buildingOptions, candidates, filteredCandidates, selectedIds, search,
    loadingBuildings, loadingCandidates, exporting, error, allFilteredSelected,
    loadBuildings, changeBuilding, toggleSelected, toggleAllFiltered, exportSelected, reset,
  }
}
