<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

definePageMeta({ title: 'Khách thuê' })

const authStore = useAuthStore()
const { tenants, total, totalPages, page, isLoading, error, q, buildingFilter, contractStateFilter } = useTenantList()

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
const contractStateOptions = [
  { value: '', label: 'Tất cả HĐ' },
  { value: 'with_contract', label: 'Có HĐ' },
  { value: 'without_contract', label: 'Chưa có HĐ' },
]

const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    q.value = searchInput.value || undefined
  }, 300)
}
</script>

<template>
  <div>
    <UiPageHeader title="Khách thuê" :description="`${total} khách thuê`">
      <template #actions>
        <NuxtLink v-if="authStore.isAdmin" to="/tenants/create">
          <UiButton>Thêm khách thuê</UiButton>
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
        v-model="contractStateFilter"
        :options="contractStateOptions"
        placeholder="Tất cả HĐ"
        class="w-full sm:w-40"
      />
      <UiInput
        v-model="searchInput"
        type="text"
        placeholder="Tìm theo tên hoặc số điện thoại..."
        class="w-full max-w-sm"
        @update:model-value="onSearch"
      />
    </UiToolbar>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="n in 5" :key="n" class="h-16 rounded-xl" />
    </div>

    <!-- Error -->
    <UiAlert v-else-if="error" severity="danger">
      Không thể tải danh sách khách thuê. Vui lòng thử lại.
    </UiAlert>

    <!-- Empty -->
    <UiEmptyState
      v-else-if="tenants.length === 0"
      title="Chưa có khách thuê nào"
      description="Bắt đầu bằng cách thêm khách thuê đầu tiên."
    >
      <template v-if="authStore.isAdmin" #action>
        <NuxtLink to="/tenants/create">
          <UiButton>Thêm khách thuê đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <!-- List -->
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="tenant in tenants"
        :key="tenant.id"
        :to="`/tenants/${tenant.id}`"
        class="flex items-center justify-between px-4 py-3 rounded-xl bg-dark-surface border border-dark-border hover:border-cyan/40 transition-colors"
      >
        <div>
          <p class="text-sm font-medium text-white">{{ tenant.fullName }}</p>
          <p class="text-xs text-muted mt-0.5">Tạo {{ new Date(tenant.createdAt).toLocaleDateString('vi-VN') }}</p>
          <p class="text-xs text-muted mt-0.5">{{ tenant.phone }}{{ tenant.idNumber ? ` · CMND/CCCD: ${tenant.idNumber}` : '' }}</p>
        </div>
        <span class="text-muted text-xs">›</span>
        <p v-if="tenant.activeAssignment" class="text-xs text-muted">
          Phòng {{ tenant.activeAssignment.roomNumber }} · {{ tenant.activeAssignment.buildingName }}
        </p>
        <UiBadge :variant="tenant.hasActiveContract ? 'success' : 'neutral'" pill>
          {{ tenant.hasActiveContract ? 'Có HĐ' : 'Chưa có HĐ' }}
        </UiBadge>
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
