<script setup lang="ts">
import { buildingEditPath, buildingSettingsPath } from '~/utils/routes/operational'

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()
const id = route.params.id as string

const { building, isLoading, error, refresh } = useBuildingDetail(id)
const {
  services: buildingServices,
  isLoading: loadingServices,
  updateService: updateBuildingService,
  refresh: refreshBuildingServices,
} = useBuildingServices(id)

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/buildings')
})

const showDeleteModal = ref(false)
const isDeleting = ref(false)
const togglingServiceId = ref<string | null>(null)

interface ConflictDetails {
  rooms?: number
  activeContracts?: number
}

const conflictDetails = ref<ConflictDetails | null>(null)

async function confirmDelete() {
  if (!building.value) return
  isDeleting.value = true
  conflictDetails.value = null
  try {
    await $fetch(`/api/buildings/${id}`, { method: 'DELETE' })
    showDeleteModal.value = false
    await navigateTo('/buildings')
  }
  catch (e: unknown) {
    const err = e as {
      statusCode?: number
      data?: { error?: { code?: string; details?: ConflictDetails } }
    }
    if (err?.statusCode === 409 || err?.data?.error?.code === 'CONFLICT') {
      conflictDetails.value = err.data?.error?.details ?? {}
      showDeleteModal.value = false
    }
    else {
      toast.error('Không thể xoá tòa nhà. Vui lòng thử lại.')
    }
  }
  finally {
    isDeleting.value = false
  }
}

async function archiveInstead() {
  if (!building.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/buildings/${id}`, {
      method: 'DELETE',
      query: { force: true },
    })
    toast.success(`Đã lưu trữ tòa nhà ${building.value.name}`)
    conflictDetails.value = null
    await refresh()
  }
  catch {
    toast.error('Không thể lưu trữ tòa nhà.')
  }
  finally {
    isDeleting.value = false
  }
}

async function toggleBuildingService(serviceId: string, isActive: boolean) {
  togglingServiceId.value = serviceId
  try {
    await updateBuildingService(serviceId, { is_active: !isActive })
    await refreshBuildingServices()
  }
  finally {
    togglingServiceId.value = null
  }
}

const activeServicesCount = computed(() => buildingServices.value?.filter(s => s.isActive).length ?? 0)

const electricityLabel = computed(() => {
  if (!building.value) return ''
  return { per_kwh: 'Theo kWh', fixed: 'Cố định', tiered: 'Lũy kế' }[building.value.electricityPricingType]
})

const waterLabel = computed(() => {
  if (!building.value) return ''
  return { per_m3: 'Theo m³', per_person: 'Theo người', fixed_per_room: 'Cố định/phòng' }[building.value.waterPricingType]
})
</script>

<template>
  <div>
    <div v-if="isLoading" class="space-y-4">
      <UiSkeleton class="h-8 w-64 rounded-lg" />
      <UiSkeleton class="h-48 rounded-xl" />
    </div>

    <UiAlert v-else-if="error && error.statusCode !== 404" severity="danger">
      Không thể tải thông tin tòa nhà.
    </UiAlert>

    <template v-else-if="building">
      <UiPageHeader :title="building.name">
        <template #actions>
          <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
            <UiButton
              variant="secondary"
              size="sm"
              @click="navigateTo(buildingSettingsPath(building))"
            >
              Dịch vụ
            </UiButton>
            <NuxtLink :to="buildingEditPath(building)">
              <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
            </NuxtLink>
          </div>
        </template>
      </UiPageHeader>

      <UiAlert
        v-if="conflictDetails"
        severity="warning"
        class="mt-6"
        data-test="delete-conflict-alert"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-white">Không thể xoá tòa nhà này</p>
            <p class="mt-1 text-xs text-muted">
              <template v-if="conflictDetails.rooms">
                Còn {{ conflictDetails.rooms }} phòng.
              </template>
              <template v-if="conflictDetails.activeContracts">
                Còn {{ conflictDetails.activeContracts }} hợp đồng đang hoạt động.
              </template>
              Bạn có thể lưu trữ tòa nhà thay vì xoá vĩnh viễn.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UiButton variant="secondary" size="sm" :loading="isDeleting" @click="archiveInstead">
              Lưu trữ thay vì xoá
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="conflictDetails = null">Đóng</UiButton>
          </div>
        </div>
      </UiAlert>

      <div class="mt-6">
        <BuildingDetailHero
          :building="building"
          :active-services="activeServicesCount"
        />
      </div>

      <!-- Section: Overview -->
      <section id="overview" class="mt-6 rounded-xl border border-dark-border bg-dark-surface p-6">
        <h3 class="text-sm font-semibold text-white mb-4">Thông tin tổng quan</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Địa chỉ</p>
            <p class="text-sm text-white">{{ building.address }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(building.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
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
        <div v-if="building.description" class="mt-4">
          <p class="text-xs text-muted mb-1">Mô tả</p>
          <p class="text-sm text-white">{{ building.description }}</p>
        </div>
      </section>

      <!-- Section: Services + Billing -->
      <section id="services" class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6">
        <header class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-white">Dịch vụ & cấu hình tính phí</h3>
          <UiButton
            v-if="authStore.isAdmin"
            variant="secondary"
            size="sm"
            @click="navigateTo(buildingSettingsPath(building))"
          >
            Quản lý dịch vụ
          </UiButton>
        </header>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p class="text-xs text-muted mb-1">Tính tiền điện</p>
            <p class="text-sm text-white">
              {{ electricityLabel }}
              <span v-if="building.defaultElectricityRate" class="text-muted"> — {{ building.defaultElectricityRate.toLocaleString('vi-VN') }}đ</span>
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Tính tiền nước</p>
            <p class="text-sm text-white">
              {{ waterLabel }}
              <span v-if="building.defaultWaterRate" class="text-muted"> — {{ building.defaultWaterRate.toLocaleString('vi-VN') }}đ</span>
            </p>
          </div>
        </div>

        <div class="rounded-lg border border-dark-border bg-dark-deep/30 p-4">
          <div v-if="loadingServices" class="space-y-2">
            <UiSkeleton v-for="n in 3" :key="n" class="h-10 rounded-lg" />
          </div>
          <div v-else-if="buildingServices.length === 0" class="text-sm text-muted">
            Chưa cấu hình dịch vụ.
          </div>
          <div v-else class="divide-y divide-dark-border">
            <div
              v-for="service in buildingServices"
              :key="service.id"
              class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ service.catalog.name }}</p>
                <p class="text-xs text-muted">
                  {{ service.defaultAmount.toLocaleString('vi-VN') }}đ · {{ service.pricingType }}
                </p>
              </div>
              <UiToggle
                v-if="authStore.isAdmin"
                :model-value="service.isActive"
                :aria-label="`${service.isActive ? 'Tắt' : 'Bật'} ${service.catalog.name}`"
                :disabled="togglingServiceId === service.id"
                @update:model-value="toggleBuildingService(service.id, service.isActive)"
              />
              <UiBadge v-else :variant="service.isActive ? 'success' : 'neutral'">
                {{ service.isActive ? 'Bật' : 'Tắt' }}
              </UiBadge>
            </div>
          </div>
        </div>
      </section>

      <!-- Section: Operations -->
      <section id="operations" class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6">
        <h3 class="text-sm font-semibold text-white mb-4">Vận hành</h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-dark-border">
          <NuxtLink
            :to="`/rooms?building=${building.slug}`"
            class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3 text-sm text-white hover:border-cyan/40 transition-colors"
          >
            <div class="flex items-center gap-2">
              <IconDoor class="h-4 w-4 text-cyan" aria-hidden="true" />
              Xem phòng ({{ building.totalRooms }})
            </div>
            <p class="mt-1 text-xs text-muted">Quản lý phòng trong tòa</p>
          </NuxtLink>
          <NuxtLink
            :to="`/contracts?building=${building.slug}`"
            class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3 text-sm text-white hover:border-cyan/40 transition-colors"
          >
            <div class="flex items-center gap-2">
              <IconDocumentText class="h-4 w-4 text-cyan" aria-hidden="true" />
              Xem hợp đồng
            </div>
            <p class="mt-1 text-xs text-muted">Hợp đồng thuê đang hoạt động</p>
          </NuxtLink>
          <NuxtLink
            :to="`/buildings/${building.slug}/meter-readings`"
            class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3 text-sm text-white hover:border-cyan/40 transition-colors"
          >
            <div class="flex items-center gap-2">
              <IconChart class="h-4 w-4 text-cyan" aria-hidden="true" />
              Đọc đồng hồ tháng này
            </div>
            <p class="mt-1 text-xs text-muted">Nhập chỉ số điện, nước</p>
          </NuxtLink>
        </div>
      </section>

      <!-- Section: Danger zone (admin only) -->
      <section
        v-if="authStore.isAdmin"
        id="danger-zone"
        class="mt-4 rounded-xl border border-error/30 bg-error/5 p-6"
      >
        <h3 class="text-sm font-semibold text-error mb-2">Vùng nguy hiểm</h3>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-muted">
            Xoá tòa nhà sẽ xoá vĩnh viễn dữ liệu. Chỉ thực hiện được khi không còn phòng và hợp đồng đang hoạt động.
          </p>
          <UiButton variant="danger" size="sm" @click="showDeleteModal = true">
            Xoá tòa nhà
          </UiButton>
        </div>
      </section>
    </template>

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
