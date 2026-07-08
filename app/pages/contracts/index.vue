<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { ContractBulkAction, ContractBulkActionResult } from '~/composables/contracts/useContractBulkActions'
import { formatCurrency } from '~/utils/format/currency'
import { contractPath } from '~/utils/routes/operational'

definePageMeta({ title: 'Hợp đồng' })

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
const {
  selectedIds,
  isSelected,
  toggle,
  selectAll,
  clear,
  runAction,
  isRunning,
} = useContractBulkActions()

const { data: buildingsData } = await useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)
const buildingOptions = computed(() =>
  (buildingsData.value?.data ?? []).map(building => ({
    value: building.id,
    label: building.name,
  })),
)

const actionMenuOpen = ref(false)

async function openCreateContract() {
  actionMenuOpen.value = false
  await navigateTo('/contracts/create')
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

function handleBulkDone(result: ContractBulkActionResult, action: ContractBulkAction) {
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
  refresh()
}

watch(contracts, () => {
  selectedIds.value = selectedIds.value.filter(id => visibleIds.value.includes(id))
})
</script>

<template>
  <div>
    <UiPageHeader title="Hợp đồng" :description="`${total} hợp đồng`">
      <template #actions>
        <div v-if="authStore.can('contracts.create')" class="relative">
          <UiButton
            variant="ghost"
            size="sm"
            @click="actionMenuOpen = !actionMenuOpen"
          >
            <span>Hành động</span>
            <IconChevronDown class="h-4 w-4 -mr-1" aria-hidden="true" />
          </UiButton>
          <template v-if="actionMenuOpen">
            <div
              class="fixed inset-0 z-30"
              aria-hidden="true"
              @click="actionMenuOpen = false"
            />
            <div
              class="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-dark-border bg-dark-card py-1 shadow-lg shadow-black/40"
            >
              <UiButton
                variant="ghost"
                size="sm"
                class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                @click="openCreateContract"
              >
                <IconPlus class="h-4 w-4" aria-hidden="true" />
                <span>Thêm hợp đồng</span>
              </UiButton>
            </div>
          </template>
        </div>
      </template>
    </UiPageHeader>

    <ContractListToolbar
      v-model:q="q"
      v-model:building-filter="buildingFilter"
      v-model:status="status"
      v-model:sort="sort"
      v-model:order="order"
      :building-options="buildingOptions"
      :has-active-filters="hasActiveFilters"
      class="mb-4"
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
        <NuxtLink to="/contracts/create">
          <UiButton>Thêm hợp đồng đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <!-- List -->
    <div v-else class="space-y-2">
      <div
        v-if="authStore.can('contracts.delete')"
        class="flex items-center gap-3 rounded-xl border border-transparent px-4 py-1"
      >
        <UiCheckbox
          :model-value="allVisibleSelected"
          :indeterminate="someVisibleSelected"
          aria-label="Chọn tất cả hợp đồng trên trang"
          @update:model-value="toggleSelectAll"
        />
        <span class="text-sm text-muted select-none">
          {{ selectedIds.length > 0 ? `Đã chọn ${selectedIds.length}` : 'Chọn tất cả trên trang' }}
        </span>
      </div>

      <div
        v-for="contract in contracts"
        :key="contract.id"
        class="group flex items-center gap-3 rounded-xl border border-dark-border bg-dark-surface px-4 py-3 transition-colors hover:border-cyan/40"
      >
        <UiCheckbox
          v-if="authStore.can('contracts.delete')"
          class="shrink-0"
          :model-value="isSelected(contract.id)"
          :aria-label="`Chọn hợp đồng ${contract.contractCode}`"
          @update:model-value="toggle(contract.id)"
          @click.stop
        />
        <NuxtLink :to="contractPath(contract)" class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="text-sm font-medium text-white truncate">
              Phòng {{ contract.room.roomNumber }} — {{ contract.room.buildingName }}
            </p>
            <UiStatusBadge :status="contract.status" />
            <span class="text-xs text-muted font-mono">{{ contract.contractCode }}</span>
          </div>
          <p class="text-xs text-muted mt-0.5 truncate">
            {{ contract.tenant.fullName }} ·
            {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} — {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
            · {{ formatCurrency(contract.monthlyRent) }}/tháng
          </p>
        </NuxtLink>
        <IconChevronRight class="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-cyan" aria-hidden="true" />
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
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-6 pt-4 border-t border-dark-border">
      <p class="text-sm text-muted">Trang {{ page }} / {{ totalPages }}</p>
      <div class="flex gap-2">
        <UiButton variant="secondary" size="sm" :disabled="page <= 1" @click="page--">← Trước</UiButton>
        <UiButton variant="secondary" size="sm" :disabled="page >= totalPages" @click="page++">Tiếp →</UiButton>
      </div>
    </div>
  </div>
</template>
