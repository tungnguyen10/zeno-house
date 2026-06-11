<script setup lang="ts">
const route = useRoute()
const authStore = useAuthStore()
const id = route.params.id as string

const { building, isLoading, error } = useBuildingDetail(id)

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/buildings')
})

const showDeleteModal = ref(false)
const isDeleting = ref(false)

async function confirmDelete() {
  isDeleting.value = true
  try {
    await $fetch(`/api/buildings/${id}`, { method: 'DELETE' })
    await navigateTo('/buildings')
  }
  finally {
    isDeleting.value = false
    showDeleteModal.value = false
  }
}


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
      Không thể tải thông tin tòa nhà.
    </UiAlert>

    <!-- Detail -->
    <template v-else-if="building">
      <UiPageHeader :title="building.name">
        <template #actions>
        <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
          <UiButton
            variant="secondary"
            size="sm"
            @click="navigateTo(`/billing?building=${id}`)"
          >
            Vận hành tháng {{ new Date().getMonth() + 1 }}
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            @click="navigateTo(`/buildings/${id}/settings`)"
          >
            Dịch vụ
          </UiButton>
          <NuxtLink :to="`/buildings/${building.id}/edit`">
            <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
          </NuxtLink>
          <UiButton variant="danger" size="sm" @click="showDeleteModal = true">Xoá</UiButton>
        </div>
        </template>
      </UiPageHeader>

      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-4 mt-6">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Địa chỉ</p>
            <p class="text-sm text-white">{{ building.address }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Trạng thái</p>
            <UiStatusBadge :status="building.status" />
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Số phòng</p>
            <p class="text-sm text-white">{{ building.totalRooms }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(building.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
        </div>
        <div v-if="building.description">
          <p class="text-xs text-muted mb-1">Mô tả</p>
          <p class="text-sm text-white">{{ building.description }}</p>
        </div>
      </div>

      <!-- Owner / Contact -->
      <div
        v-if="building.ownerName || building.ownerPhone || building.ownerEmail"
        class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4"
      >
        <h3 class="text-sm font-semibold text-white mb-4">Chủ sở hữu</h3>
        <div class="grid grid-cols-2 gap-4">
          <div v-if="building.ownerName">
            <p class="text-xs text-muted mb-1">Tên chủ nhà</p>
            <p class="text-sm text-white">{{ building.ownerName }}</p>
          </div>
          <div v-if="building.ownerPhone">
            <p class="text-xs text-muted mb-1">Số điện thoại</p>
            <p class="text-sm text-white">{{ building.ownerPhone }}</p>
          </div>
          <div v-if="building.ownerEmail">
            <p class="text-xs text-muted mb-1">Email</p>
            <p class="text-sm text-white">{{ building.ownerEmail }}</p>
          </div>
        </div>
      </div>

      <!-- Billing config -->
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4">
        <h3 class="text-sm font-semibold text-white mb-4">Cấu hình tính phí</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Tính tiền điện</p>
            <p class="text-sm text-white capitalize">
              {{ { per_kwh: 'Theo kWh', fixed: 'Cố định', tiered: 'Lũy kế' }[building.electricityPricingType] }}
              <span v-if="building.defaultElectricityRate" class="text-muted"> — {{ building.defaultElectricityRate.toLocaleString('vi-VN') }}đ</span>
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Tính tiền nước</p>
            <p class="text-sm text-white">
              {{ { per_m3: 'Theo m³', per_person: 'Theo người', fixed_per_room: 'Cố định/phòng' }[building.waterPricingType] }}
              <span v-if="building.defaultWaterRate" class="text-muted"> — {{ building.defaultWaterRate.toLocaleString('vi-VN') }}đ</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Schedule -->
      <div
        v-if="building.meterReadingDay || building.billingGenerationDay || building.paymentDueDay"
        class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4"
      >
        <h3 class="text-sm font-semibold text-white mb-4">Lịch vận hành</h3>
        <div class="grid grid-cols-2 gap-4">
          <div v-if="building.meterReadingDay">
            <p class="text-xs text-muted mb-1">Ngày chốt số</p>
            <p class="text-sm text-white">{{ building.meterReadingDay }}</p>
          </div>
          <div v-if="building.billingGenerationDay">
            <p class="text-xs text-muted mb-1">Ngày lập hóa đơn</p>
            <p class="text-sm text-white">{{ building.billingGenerationDay }}</p>
          </div>
          <div v-if="building.paymentDueDay">
            <p class="text-xs text-muted mb-1">Ngày đến hạn</p>
            <p class="text-sm text-white">{{ building.paymentDueDay }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Số ngày gia hạn</p>
            <p class="text-sm text-white">{{ building.gracePeriodDays }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- Delete confirmation modal -->
    <UiConfirmModal
      :open="showDeleteModal"
      title="Xác nhận xoá"
      :message="`Bạn có chắc muốn xoá tòa nhà ${building?.name ?? ''}? Hành động này không thể hoàn tác.`"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
