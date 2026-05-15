<script setup lang="ts">
import type { RoomAssignmentWithRoom } from '~/types/room-assignments'
import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import { formatCurrency } from '~/utils/format/currency'

definePageMeta({ title: 'Chi tiết khách thuê' })

const route = useRoute()
const authStore = useAuthStore()
const id = route.params.id as string

const { tenant, isLoading, error } = useTenantDetail(id)

// Current room assignment
const { data: assignmentData } = await useFetch<ApiSuccess<RoomAssignmentWithRoom | null>>(
  `/api/room-assignments/tenant/${id}`,
)
const currentAssignment = computed(() => assignmentData.value?.data ?? null)

// Contracts
const { data: contractsData } = await useFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>(
  '/api/contracts',
  { query: { tenant_id: id, limit: 50 } },
)
const tenantContracts = computed(() => contractsData.value?.data ?? [])

const showDeleteModal = ref(false)
const isDeleting = ref(false)

async function confirmDelete() {
  isDeleting.value = true
  try {
    await $fetch(`/api/tenants/${id}`, { method: 'DELETE' })
    await navigateTo('/tenants')
  }
  finally {
    isDeleting.value = false
    showDeleteModal.value = false
  }
}

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/tenants')
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
      Không thể tải thông tin khách thuê.
    </div>

    <!-- Detail -->
    <template v-else-if="tenant">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <NuxtLink to="/tenants" class="text-sm text-muted hover:text-white transition-colors">
            ← Danh sách khách thuê
          </NuxtLink>
          <h1 class="text-xl font-semibold text-white mt-2">{{ tenant.fullName }}</h1>
          <p class="text-sm text-muted mt-0.5">{{ tenant.phone }}</p>
        </div>
        <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
          <NuxtLink :to="`/tenants/${tenant.id}/edit`">
            <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
          </NuxtLink>
          <UiButton variant="danger" size="sm" @click="showDeleteModal = true">Xoá</UiButton>
        </div>
      </div>

      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Số điện thoại</p>
            <p class="text-sm text-white">{{ tenant.phone }}</p>
          </div>
          <div v-if="tenant.email">
            <p class="text-xs text-muted mb-1">Email</p>
            <p class="text-sm text-white">{{ tenant.email }}</p>
          </div>
          <div v-if="tenant.idNumber">
            <p class="text-xs text-muted mb-1">Số CMND/CCCD</p>
            <p class="text-sm text-white">{{ tenant.idNumber }}</p>
          </div>
          <div v-if="tenant.dateOfBirth">
            <p class="text-xs text-muted mb-1">Ngày sinh</p>
            <p class="text-sm text-white">{{ new Date(tenant.dateOfBirth).toLocaleDateString('vi-VN') }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(tenant.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
        </div>
        <div v-if="tenant.permanentAddress">
          <p class="text-xs text-muted mb-1">Địa chỉ thường trú</p>
          <p class="text-sm text-white">{{ tenant.permanentAddress }}</p>
        </div>
        <div v-if="tenant.notes">
          <p class="text-xs text-muted mb-1">Ghi chú</p>
          <p class="text-sm text-white">{{ tenant.notes }}</p>
        </div>
      </div>

      <!-- Current room section -->
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4">
        <h2 class="text-sm font-semibold text-white mb-3">Phòng đang thuê</h2>
        <div v-if="currentAssignment">
          <NuxtLink
            :to="`/rooms/${currentAssignment.room.id}`"
            class="text-sm font-medium text-white hover:text-cyan transition-colors"
          >
            Phòng {{ currentAssignment.room.roomNumber }}
          </NuxtLink>
          <p class="text-sm text-muted mt-0.5">Tầng {{ currentAssignment.room.floor }} — {{ currentAssignment.room.buildingName }}</p>
          <p class="text-xs text-muted mt-1">Từ ngày {{ new Date(currentAssignment.startDate).toLocaleDateString('vi-VN') }}</p>
        </div>
        <p v-else class="text-sm text-muted">Chưa có phòng</p>
      </div>

      <!-- Contracts section -->
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-white">Hợp đồng</h2>
          <NuxtLink v-if="authStore.isAdmin" to="/contracts/create" class="text-xs text-cyan hover:underline">
            + Thêm
          </NuxtLink>
        </div>
        <div v-if="tenantContracts.length > 0" class="space-y-2">
          <NuxtLink
            v-for="contract in tenantContracts"
            :key="contract.id"
            :to="`/contracts/${contract.id}`"
            class="flex items-center justify-between rounded-lg border border-dark-border px-3 py-2 hover:border-cyan/40 transition-colors"
          >
            <div>
              <div class="flex items-center gap-2">
                <p class="text-xs font-medium text-white">Phòng {{ contract.room.roomNumber }} — {{ contract.room.buildingName }}</p>
                <UiStatusBadge :status="contract.status" />
              </div>
              <p class="text-xs text-muted mt-0.5">
                {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} — {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
                · {{ formatCurrency(contract.monthlyRent) }}/tháng
              </p>
            </div>
            <span class="text-muted text-xs ml-2">›</span>
          </NuxtLink>
        </div>
        <p v-else class="text-sm text-muted">Chưa có hợp đồng</p>
      </div>
    </template>

    <!-- Delete modal -->
    <UiConfirmModal
      :open="showDeleteModal"
      title="Xác nhận xoá"
      :message="`Bạn có chắc muốn xoá khách thuê ${tenant?.fullName ?? ''}? Hành động này không thể hoàn tác.`"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
