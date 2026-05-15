<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'

definePageMeta({ title: 'Chi tiết hợp đồng' })

const route = useRoute()
const authStore = useAuthStore()
const id = route.params.id as string

const { contract, isLoading, error } = useContractDetail(id)

const showDeleteModal = ref(false)
const isDeleting = ref(false)

async function confirmDelete() {
  isDeleting.value = true
  try {
    await $fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    await navigateTo('/contracts')
  }
  finally {
    isDeleting.value = false
    showDeleteModal.value = false
  }
}

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/contracts')
})
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isLoading" class="space-y-4">
      <UiSkeleton class="h-8 w-64 rounded-lg" />
      <UiSkeleton class="h-48 rounded-xl" />
    </div>

    <!-- Error -->
    <div v-else-if="error && error.statusCode !== 404" class="text-sm text-error p-4 rounded-lg bg-error/10 border border-error/20">
      Không thể tải thông tin hợp đồng.
    </div>

    <!-- Detail -->
    <template v-else-if="contract">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <NuxtLink to="/contracts" class="text-sm text-muted hover:text-white transition-colors">
            ← Danh sách hợp đồng
          </NuxtLink>
          <div class="flex items-center gap-3 mt-2">
            <h1 class="text-xl font-semibold text-white">Hợp đồng</h1>
            <UiStatusBadge :status="contract.status" />
          </div>
          <p class="text-xs text-muted mt-0.5 font-mono">{{ contract.id }}</p>
        </div>
        <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
          <NuxtLink :to="`/contracts/${contract.id}/edit`">
            <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
          </NuxtLink>
          <UiButton variant="danger" size="sm" @click="showDeleteModal = true">Xoá</UiButton>
        </div>
      </div>

      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Ngày bắt đầu</p>
            <p class="text-sm text-white">{{ new Date(contract.startDate).toLocaleDateString('vi-VN') }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày kết thúc</p>
            <p class="text-sm text-white">{{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Giá thuê / tháng</p>
            <p class="text-sm text-white font-medium">{{ formatCurrency(contract.monthlyRent) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Tiền đặt cọc</p>
            <p class="text-sm text-white">{{ formatCurrency(contract.deposit) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(contract.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
        </div>
        <div v-if="contract.notes">
          <p class="text-xs text-muted mb-1">Ghi chú</p>
          <p class="text-sm text-white">{{ contract.notes }}</p>
        </div>
      </div>

      <!-- Room section -->
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4">
        <h2 class="text-sm font-semibold text-white mb-3">Phòng</h2>
        <NuxtLink
          :to="`/rooms/${contract.room.id}`"
          class="text-sm font-medium text-white hover:text-cyan transition-colors"
        >
          Phòng {{ contract.room.roomNumber }}
        </NuxtLink>
        <p class="text-sm text-muted mt-0.5">Tầng {{ contract.room.floor }} — {{ contract.room.buildingName }}</p>
      </div>

      <!-- Tenant section -->
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4">
        <h2 class="text-sm font-semibold text-white mb-3">Khách thuê</h2>
        <NuxtLink
          :to="`/tenants/${contract.tenant.id}`"
          class="text-sm font-medium text-white hover:text-cyan transition-colors"
        >
          {{ contract.tenant.fullName }}
        </NuxtLink>
        <p class="text-sm text-muted mt-0.5">{{ contract.tenant.phone }}</p>
      </div>
    </template>

    <!-- Delete modal -->
    <UiConfirmModal
      :open="showDeleteModal"
      title="Xác nhận xoá"
      message="Bạn có chắc muốn xoá hợp đồng này? Hành động này không thể hoàn tác."
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
