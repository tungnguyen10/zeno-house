<script setup lang="ts">

import { buildingEditPath, buildingSettingsPath } from '~/utils/routes/operational'
import { getApiErrorCode, getApiErrorDetails, type ApiErrorLike } from '~/utils/api-error'

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
  if (error.value?.statusCode === 404) navigateTo('/dashboard/buildings')
})

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value && building.value ? building.value.name : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  // A newer page can claim this slot before this instance unmounts during a
  // page transition — only clear it if it's still ours.
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
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
    await apiFetch(`/api/buildings/${id}`, { method: 'DELETE' })
    showDeleteModal.value = false
    await navigateTo('/dashboard/buildings')
  }
  catch (e: unknown) {
    const err = e as ApiErrorLike
    if (err.statusCode === 409 || getApiErrorCode(err) === 'CONFLICT') {
      conflictDetails.value = getApiErrorDetails<ConflictDetails>(err) ?? {}
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
    await apiFetch(`/api/buildings/${id}`, {
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
      <UiPageHeader
        :title="building.name"
        :back-to="'/dashboard/buildings'"
        back-label="Tòa nhà"
      >
        <div ref="titleSentinel" aria-hidden="true" />
        <template #actions>
          <div v-if="authStore.canManage" class="flex gap-2 shrink-0">
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
            <p class="text-sm font-medium text-ui-primary">Không thể xoá tòa nhà này</p>
            <p class="mt-1 text-xs text-ui-muted">
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
      <UiSurfacePanel id="overview" as="section" class="mt-6">
        <h3 class="mb-2 text-sm font-semibold text-ui-primary">Thông tin tổng quan</h3>
        <UiDefinitionList>
          <UiDefinitionItem label="Địa chỉ" :value="building.address" />
          <UiDefinitionItem label="Ngày tạo" :value="new Date(building.createdAt).toLocaleDateString('vi-VN')" />
          <UiDefinitionItem v-if="building.ownerName" label="Tên chủ nhà" :value="building.ownerName" />
          <UiDefinitionItem v-if="building.ownerPhone" label="Số điện thoại" :value="building.ownerPhone" />
          <UiDefinitionItem v-if="building.ownerEmail" label="Email" :value="building.ownerEmail" />
          <UiDefinitionItem v-if="building.description" label="Mô tả" :value="building.description" stacked />
        </UiDefinitionList>
      </UiSurfacePanel>

      <!-- Section: Services + Billing -->
      <UiSurfacePanel id="services" as="section" class="mt-4">
        <header class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-ui-primary">Dịch vụ & cấu hình tính phí</h3>
          <UiButton
            v-if="authStore.canManage"
            variant="secondary"
            size="sm"
            @click="navigateTo(buildingSettingsPath(building))"
          >
            Quản lý dịch vụ
          </UiButton>
        </header>

        <UiDefinitionList class="mb-4">
          <UiDefinitionItem label="Tính tiền điện">
            {{ electricityLabel }}
            <span v-if="building.defaultElectricityRate" class="text-ui-muted"> — {{ building.defaultElectricityRate.toLocaleString('vi-VN') }}đ</span>
          </UiDefinitionItem>
          <UiDefinitionItem label="Tính tiền nước">
            {{ waterLabel }}
            <span v-if="building.defaultWaterRate" class="text-ui-muted"> — {{ building.defaultWaterRate.toLocaleString('vi-VN') }}đ</span>
          </UiDefinitionItem>
        </UiDefinitionList>

        <div class="rounded-lg border border-ui-border bg-ui-deep/30 p-4">
          <div v-if="loadingServices" class="space-y-2">
            <UiSkeleton v-for="n in 3" :key="n" class="h-10 rounded-lg" />
          </div>
          <div v-else-if="buildingServices.length === 0" class="text-sm text-ui-muted">
            Chưa cấu hình dịch vụ.
          </div>
          <div v-else class="divide-y divide-ui-border">
            <div
              v-for="service in buildingServices"
              :key="service.id"
              class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-ui-primary truncate">{{ service.catalog.name }}</p>
                <p class="text-xs text-ui-muted">
                  {{ service.defaultAmount.toLocaleString('vi-VN') }}đ · {{ service.pricingType }}
                </p>
              </div>
              <UiToggle
                v-if="authStore.canManage"
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
      </UiSurfacePanel>

      <!-- Section: Operations -->
      <UiSurfacePanel id="operations" as="section" class="mt-4">
        <h3 class="mb-2 text-sm font-semibold text-ui-primary">Vận hành</h3>

        <UiDefinitionList class="mb-4">
          <UiDefinitionItem v-if="building.meterReadingDay" label="Ngày chốt số" :value="building.meterReadingDay" />
          <UiDefinitionItem v-if="building.billingGenerationDay" label="Ngày lập hóa đơn" :value="building.billingGenerationDay" />
          <UiDefinitionItem v-if="building.paymentDueDay" label="Ngày đến hạn" :value="building.paymentDueDay" />
          <UiDefinitionItem label="Số ngày gia hạn" :value="building.gracePeriodDays" />
        </UiDefinitionList>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-ui-border">
          <NuxtLink
            :to="`/dashboard/rooms?building=${building.slug}`"
            class="rounded-lg border border-ui-border bg-ui-deep/40 px-4 py-3 text-sm text-ui-primary hover:border-ui-accent/40 transition-colors"
          >
            <div class="flex items-center gap-2">
              <IconDoor class="h-4 w-4 text-ui-accent" aria-hidden="true" />
              Xem phòng ({{ building.totalRooms }})
            </div>
            <p class="mt-1 text-xs text-ui-muted">Quản lý phòng trong tòa</p>
          </NuxtLink>
          <NuxtLink
            :to="`/dashboard/contracts?building=${building.slug}`"
            class="rounded-lg border border-ui-border bg-ui-deep/40 px-4 py-3 text-sm text-ui-primary hover:border-ui-accent/40 transition-colors"
          >
            <div class="flex items-center gap-2">
              <IconDocumentText class="h-4 w-4 text-ui-accent" aria-hidden="true" />
              Xem hợp đồng
            </div>
            <p class="mt-1 text-xs text-ui-muted">Hợp đồng thuê đang hoạt động</p>
          </NuxtLink>
          <NuxtLink
            :to="`/dashboard/buildings/${building.slug}/meter-readings`"
            class="rounded-lg border border-ui-border bg-ui-deep/40 px-4 py-3 text-sm text-ui-primary hover:border-ui-accent/40 transition-colors"
          >
            <div class="flex items-center gap-2">
              <IconChart class="h-4 w-4 text-ui-accent" aria-hidden="true" />
              Đọc đồng hồ tháng này
            </div>
            <p class="mt-1 text-xs text-ui-muted">Nhập chỉ số điện, nước</p>
          </NuxtLink>
        </div>
      </UiSurfacePanel>

      <!-- Section: Danger zone (admin only) -->
      <section
        v-if="authStore.canManage"
        id="danger-zone"
        class="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/5 p-6"
      >
        <h3 class="text-sm font-semibold text-status-danger mb-2">Vùng nguy hiểm</h3>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-ui-muted">
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
