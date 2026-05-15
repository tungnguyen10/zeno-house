<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'

definePageMeta({ title: 'Hợp đồng' })

const authStore = useAuthStore()
const { contracts, total, totalPages, page, statusFilter, isLoading, error } = useContractList()
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-white">Hợp đồng</h1>
        <p class="text-sm text-muted mt-0.5">{{ total }} hợp đồng</p>
      </div>
      <NuxtLink v-if="authStore.isAdmin" to="/contracts/create">
        <UiButton>Thêm hợp đồng</UiButton>
      </NuxtLink>
    </div>

    <!-- Status filter -->
    <div class="mb-6">
      <select
        v-model="statusFilter"
        class="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
      >
        <option :value="undefined">Tất cả trạng thái</option>
        <option value="active">Đang hiệu lực</option>
        <option value="expired">Đã hết hạn</option>
        <option value="terminated">Đã chấm dứt</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="n in 5" :key="n" class="h-20 rounded-xl" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-sm text-error p-4 rounded-lg bg-error/10 border border-error/20">
      Không thể tải danh sách hợp đồng. Vui lòng thử lại.
    </div>

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
        :to="`/contracts/${contract.id}`"
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
