<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
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
</script>

<template>
  <div>
    <UiPageHeader title="Hợp đồng" :description="`${total} hợp đồng`">
      <template #actions>
        <NuxtLink v-if="authStore.isAdmin" to="/contracts/create">
          <UiButton>Thêm hợp đồng</UiButton>
        </NuxtLink>
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
      <template v-if="authStore.isAdmin" #action>
        <NuxtLink to="/contracts/create">
          <UiButton>Thêm hợp đồng đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <!-- List -->
    <div v-else class="space-y-2">
      <UiListRow
        v-for="contract in contracts"
        :key="contract.id"
        :to="contractPath(contract)"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm font-medium text-white truncate">
            Phòng {{ contract.room.roomNumber }} — {{ contract.room.buildingName }}
          </p>
          <UiStatusBadge :status="contract.status" />
        </div>
        <p class="text-xs text-muted mt-0.5 truncate">
          {{ contract.tenant.fullName }} ·
          {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} — {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
          · {{ formatCurrency(contract.monthlyRent) }}/tháng
        </p>
      </UiListRow>
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
