<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import { formatCurrency } from '~/utils/format/currency'
import { contractPath } from '~/utils/routes/operational'

definePageMeta({ title: 'Hợp đồng' })

const authStore = useAuthStore()
const { contracts, total, totalPages, page, statusFilter, buildingFilter, isLoading, error } = useContractList()

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

const statusOptions = [
  { value: 'active', label: 'Đang hiệu lực' },
  { value: 'expired', label: 'Đã hết hạn' },
  { value: 'terminated', label: 'Đã chấm dứt' },
]
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

    <!-- Filters -->
    <UiToolbar class="mb-6 flex-wrap">
      <UiSelect
        v-model="buildingFilter"
        :options="buildingOptions"
        placeholder="Tất cả tòa nhà"
        class="w-full sm:w-64"
      />
      <UiSelect
        v-model="statusFilter"
        :options="statusOptions"
        placeholder="Tất cả trạng thái"
        class="w-full sm:w-56"
      />
    </UiToolbar>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="n in 5" :key="n" class="h-20 rounded-xl" />
    </div>

    <!-- Error -->
    <UiAlert v-else-if="error" severity="danger">
      Không thể tải danh sách hợp đồng. Vui lòng thử lại.
    </UiAlert>

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
      <NuxtLink
        v-for="contract in contracts"
        :key="contract.id"
        :to="contractPath(contract)"
        class="flex items-center justify-between px-4 py-3 rounded-xl bg-dark-surface border border-dark-border hover:border-cyan/40 transition-colors"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium text-white truncate">
              Phòng {{ contract.room.roomNumber }} — {{ contract.room.buildingName }}
            </p>
            <UiStatusBadge :status="contract.status" />
          </div>
          <p class="text-xs text-muted mt-0.5">
            {{ contract.tenant.fullName }} ·
            {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} — {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
            · {{ formatCurrency(contract.monthlyRent) }}/tháng
          </p>
        </div>
        <span class="text-muted text-xs ml-4 shrink-0">›</span>
      </NuxtLink>
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
