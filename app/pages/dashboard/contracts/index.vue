<script setup lang="ts">

import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { ContractBulkAction, ContractBulkActionResult } from '~/composables/contracts/useContractBulkActions'
import { CONTRACT_LIST_ASYNC_KEY } from '~/composables/contracts/useContractList'
import { formatCurrency } from '~/utils/format/currency'
import { contractPath } from '~/utils/routes/operational'

definePageMeta({ title: 'Hợp đồng' })

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Hợp đồng' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  // A newer page can claim this slot before this instance unmounts during a
  // page transition — only clear it if it's still ours.
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const authStore = useAuthStore()
const {
  contracts,
  total,
  totalPages,
  page,
  q,
  buildingFilter,
  status,
  sort,
  order,
  hasActiveFilters,
  resetFilters,
  isLoading,
  error,
  refresh,
} = useContractList()
const toast = useToast()

function handleSortChange(value: typeof sort.value) {
  sort.value = value
  order.value = value === 'location' ? 'asc' : 'desc'
}

const {
  selectedIds,
  isSelected,
  toggle,
  selectAll,
  clear,
  runAction,
  isRunning,
} = useContractBulkActions()

const { data: buildingsData } = useLazyFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)
const buildingOptions = computed(() =>
  (buildingsData.value?.data ?? []).map(building => ({
    value: building.id,
    label: building.name,
  })),
)

async function openCreateContract() {
  await navigateTo('/dashboard/contracts/create')
}

const visibleIds = computed(() => contracts.value.map(contract => contract.id))
const allVisibleSelected = computed(() =>
  visibleIds.value.length > 0 && visibleIds.value.every(id => selectedIds.value.includes(id)),
)
const someVisibleSelected = computed(() =>
  !allVisibleSelected.value && visibleIds.value.some(id => selectedIds.value.includes(id)),
)

function toggleSelectAll() {
  if (allVisibleSelected.value) {
    selectedIds.value = selectedIds.value.filter(id => !visibleIds.value.includes(id))
  }
  else {
    selectAll([...new Set([...selectedIds.value, ...visibleIds.value])])
  }
}

async function handleBulkDone(result: ContractBulkActionResult, action: ContractBulkAction) {
  const verb = action === 'terminate' ? 'kết thúc' : 'xoá'
  if (result.succeeded.length > 0 && result.failed.length === 0) {
    toast.success(`Đã ${verb} ${result.succeeded.length} hợp đồng`)
  }
  else if (result.succeeded.length > 0 && result.failed.length > 0) {
    toast.info(`Đã ${verb} ${result.succeeded.length} hợp đồng, ${result.failed.length} bị bỏ qua`)
  }
  else if (result.failed.length > 0) {
    toast.error(`Không thể ${verb}. ${result.failed.length} hợp đồng bị bỏ qua`)
  }
  clear()
  await refreshNuxtData(CONTRACT_LIST_ASYNC_KEY)
}

watch(contracts, () => {
  selectedIds.value = selectedIds.value.filter(id => visibleIds.value.includes(id))
})
</script>

<template>
  <AppPullToRefresh :on-refresh="refresh">
  <div>
    <UiPageHeader title="Hợp đồng" :description="`${total} hợp đồng`">
      <div ref="titleSentinel" aria-hidden="true" />
      <template #actions>
        <UiDropdownMenu v-if="authStore.can('contracts.create')">
          <UiDropdownMenuItem @click="openCreateContract">
            <template #icon>
              <IconPlus class="h-4 w-4 shrink-0" aria-hidden="true" />
            </template>
            Thêm hợp đồng
          </UiDropdownMenuItem>
        </UiDropdownMenu>
      </template>
    </UiPageHeader>

    <ContractListToolbar
      v-model:q="q"
      v-model:building-filter="buildingFilter"
      v-model:status="status"
      v-model:order="order"
      :sort="sort"
      :building-options="buildingOptions"
      :has-active-filters="hasActiveFilters"
      class="mb-4"
      @update:sort="handleSortChange"
      @reset="resetFilters"
    />

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="n in 5" :key="n" class="h-20 rounded-xl" />
    </div>

    <!-- Error -->
    <UiAlert v-else-if="error" severity="danger">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>Không thể tải danh sách hợp đồng.</span>
        <UiButton variant="secondary" size="sm" @click="refresh()">Thử lại</UiButton>
      </div>
    </UiAlert>

    <!-- Empty with filters -->
    <UiEmptyState
      v-else-if="contracts.length === 0 && hasActiveFilters"
      variant="search"
      title="Không tìm thấy hợp đồng phù hợp"
      description="Thử bỏ bớt bộ lọc hoặc thay đổi từ khoá tìm kiếm."
    >
      <template #action>
        <UiButton variant="secondary" @click="resetFilters">Xoá bộ lọc</UiButton>
      </template>
    </UiEmptyState>

    <!-- Empty -->
    <UiEmptyState
      v-else-if="contracts.length === 0"
      title="Chưa có hợp đồng nào"
      description="Bắt đầu bằng cách tạo hợp đồng đầu tiên."
    >
      <template v-if="authStore.can('contracts.create')" #action>
        <NuxtLink to="/dashboard/contracts/create">
          <UiButton>Thêm hợp đồng đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <!-- List -->
    <div v-else class="space-y-2">
      <UiSelectAllBar
        v-if="authStore.can('contracts.delete')"
        :model-value="allVisibleSelected"
        :indeterminate="someVisibleSelected"
        :page-count="contracts.length"
        :total-selected="selectedIds.length"
        aria-label="Chọn tất cả hợp đồng trên trang"
        @update:model-value="toggleSelectAll"
      />

      <div
        v-for="contract in contracts"
        :key="contract.id"
        class="group flex items-center gap-3 rounded-xl border border-ui-border bg-ui-surface px-4 py-3 transition-colors hover:border-ui-accent/40"
      >
        <UiCheckbox
          v-if="authStore.can('contracts.delete')"
          class="shrink-0"
          :model-value="isSelected(contract.id)"
          :aria-label="`Chọn hợp đồng ${contract.contractCode}`"
          shape="circle"
          @update:model-value="toggle(contract.id)"
          @click.stop
        />
        <NuxtLink :to="contractPath(contract)" class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="text-sm font-medium text-ui-primary truncate">
              Phòng {{ contract.room.roomNumber }} — {{ contract.room.buildingName }}
            </p>
            <UiStatusBadge :status="contract.status" />
            <span class="text-xs text-ui-muted font-mono">{{ contract.contractCode }}</span>
          </div>
          <p class="text-xs text-ui-muted mt-0.5 truncate">
            {{ contract.tenant.fullName }} ·
            {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} — {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
            · {{ formatCurrency(contract.monthlyRent) }}/tháng
          </p>
        </NuxtLink>
        <IconChevronRight class="h-4 w-4 shrink-0 text-ui-muted transition-colors group-hover:text-ui-accent" aria-hidden="true" />
      </div>

      <ContractBulkActionsBar
        v-if="authStore.can('contracts.delete') && selectedIds.length > 0"
        :selected-ids="selectedIds"
        :contracts="contracts"
        :run-action="runAction"
        :is-running="isRunning"
        @clear="clear"
        @done="handleBulkDone"
      />
    </div>

    <!-- Pagination -->
    <UiPagination
      :page="page"
      :total-pages="totalPages"
      @update:page="page = $event"
    />
  </div>
  </AppPullToRefresh>
</template>
