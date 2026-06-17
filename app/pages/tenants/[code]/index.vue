<script setup lang="ts">
import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import type { Tenant } from '~/types/tenants'
import { formatCurrency } from '~/utils/format/currency'
import { contractPath, tenantPath } from '~/utils/routes/operational'
import { isUuid } from '~/utils/format/slug'

definePageMeta({ title: 'Chi tiết khách thuê' })

const route = useRoute()
const authStore = useAuthStore()
const id = route.params.code as string

// Redirect UUID-based URLs to code-based canonical URL
if (isUuid(id)) {
  const { data: redirectData } = await useFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`)
  if (redirectData.value?.data) {
    await navigateTo(tenantPath(redirectData.value.data), { replace: true })
  }
}

const { tenant, isLoading, error } = useTenantDetail(id)

// Contracts
const { data: contractsData } = await useFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>(
  '/api/contracts',
  { query: { tenant_id: id, limit: 50 } },
)
const tenantContracts = computed(() => contractsData.value?.data ?? [])
const activeContract = computed(() => tenantContracts.value.find(c => c.status === 'active') ?? null)

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
    <UiAlert v-else-if="error && error.statusCode !== 404" severity="danger">
      Không thể tải thông tin khách thuê.
    </UiAlert>

    <!-- Detail -->
    <template v-else-if="tenant">
      <UiPageHeader :title="tenant.fullName" :description="tenant.phone">
        <template #actions>
          <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
            <NuxtLink :to="`/tenants/${tenant.code}/edit`">
              <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
            </NuxtLink>
            <UiButton variant="danger" size="sm" @click="showDeleteModal = true">Xoá</UiButton>
          </div>
        </template>
      </UiPageHeader>

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
          <div v-if="tenant.gender">
            <p class="text-xs text-muted mb-1">Giới tính</p>
            <p class="text-sm text-white">{{ tenant.gender === 'male' ? 'Nam' : tenant.gender === 'female' ? 'Nữ' : 'Khác' }}</p>
          </div>
          <div v-if="tenant.occupation">
            <p class="text-xs text-muted mb-1">Nghề nghiệp</p>
            <p class="text-sm text-white">{{ tenant.occupation }}</p>
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

        <!-- CMND/CCCD -->
        <div v-if="tenant.idNumber || tenant.idIssuedDate || tenant.idIssuedPlace" class="pt-3 border-t border-dark-border space-y-3">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">CMND / CCCD</p>
          <div class="grid grid-cols-2 gap-4">
            <div v-if="tenant.idNumber">
              <p class="text-xs text-muted mb-1">Số CMND/CCCD</p>
              <p class="text-sm text-white">{{ tenant.idNumber }}</p>
            </div>
            <div v-if="tenant.idIssuedDate">
              <p class="text-xs text-muted mb-1">Ngày cấp</p>
              <p class="text-sm text-white">{{ new Date(tenant.idIssuedDate).toLocaleDateString('vi-VN') }}</p>
            </div>
            <div v-if="tenant.idIssuedPlace">
              <p class="text-xs text-muted mb-1">Nơi cấp</p>
              <p class="text-sm text-white">{{ tenant.idIssuedPlace }}</p>
            </div>
          </div>
        </div>

        <!-- Liên hệ khẩn cấp -->
        <div v-if="tenant.emergencyContactName || tenant.emergencyContactPhone" class="pt-3 border-t border-dark-border space-y-3">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Liên hệ khẩn cấp</p>
          <div class="grid grid-cols-2 gap-4">
            <div v-if="tenant.emergencyContactName">
              <p class="text-xs text-muted mb-1">Tên</p>
              <p class="text-sm text-white">{{ tenant.emergencyContactName }}</p>
            </div>
            <div v-if="tenant.emergencyContactPhone">
              <p class="text-xs text-muted mb-1">Số điện thoại</p>
              <p class="text-sm text-white">{{ tenant.emergencyContactPhone }}</p>
            </div>
          </div>
        </div>

        <div v-if="tenant.notes">
          <p class="text-xs text-muted mb-1">Ghi chú</p>
          <p class="text-sm text-white">{{ tenant.notes }}</p>
        </div>
      </div>

      <!-- Current room section -->
      <UiSection title="Phòng đang thuê" class="mt-6">
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <div v-if="activeContract">
            <NuxtLink
              :to="`/rooms/${activeContract.room.code}`"
              class="text-sm font-medium text-white hover:text-cyan transition-colors"
            >
              Phòng {{ activeContract.room.roomNumber }}
            </NuxtLink>
            <p class="text-sm text-muted mt-0.5">Tầng {{ activeContract.room.floor }} — {{ activeContract.room.buildingName }}</p>
            <p class="text-xs text-muted mt-1">Từ ngày {{ new Date(activeContract.startDate).toLocaleDateString('vi-VN') }}</p>
          </div>
          <p v-else class="text-sm text-muted">Chưa có phòng</p>
        </div>
      </UiSection>

      <!-- Contracts section -->
      <UiSection title="Hợp đồng" class="mt-6">
        <template v-if="authStore.isAdmin" #actions>
          <NuxtLink to="/contracts/create" class="text-xs text-cyan hover:underline">+ Thêm</NuxtLink>
        </template>
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <div v-if="tenantContracts.length > 0" class="space-y-2">
            <NuxtLink
              v-for="contract in tenantContracts"
              :key="contract.id"
              :to="contractPath(contract)"
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
      </UiSection>
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
