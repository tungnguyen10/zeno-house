<script setup lang="ts">

import type { Building } from '~/types/buildings'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractService } from '~/types/contract-services'
import type { ApiSuccess } from '~/types/api'
import type { MeterReading } from '~/types/meter-readings'
import type { Room } from '~/types/rooms'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'
import { formatCurrency } from '~/utils/format/currency'
import { buildingPath, contractPath, roomEditPath, roomPath } from '~/utils/routes/operational'
import { getApiErrorCode, getApiErrorDetails, type ApiErrorLike } from '~/utils/api-error'
import { isUuid } from '~/utils/format/slug'

definePageMeta({ title: 'Chi tiết phòng' })

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()
const id = route.params.code as string

if (isUuid(id)) {
  const { data: redirectData } = await useFetch<ApiSuccess<Room>>(`/api/rooms/${id}`)
  if (redirectData.value?.data) {
    await navigateTo(roomPath(redirectData.value.data), { replace: true })
  }
}

const { room, isLoading, error, refresh: refreshRoom } = useRoomDetail(id)

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value && room.value ? `Phòng ${room.value.roomNumber}` : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  // A newer page can claim this slot before this instance unmounts during a
  // page transition — only clear it if it's still ours.
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const buildingId = computed(() => room.value?.buildingId ?? '')
const { data: buildingData, refresh: refreshBuilding } = await useFetch<ApiSuccess<Building>>(
  computed(() => buildingId.value ? `/api/buildings/${buildingId.value}` : '/api/buildings/__missing'),
  { immediate: false },
)
watch(buildingId, () => {
  if (buildingId.value) refreshBuilding()
}, { immediate: true })
const building = computed(() => buildingData.value?.data ?? null)

const { data: contractsData } = await useFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>(
  '/api/contracts',
  { query: { room_id: id, limit: 50 } },
)
const roomContracts = computed(() => contractsData.value?.data ?? [])
const activeContract = computed(() => roomContracts.value.find(c => c.status === 'active') ?? null)
const occupantCount = computed(() => activeContract.value?.occupantCount ?? 0)

const { data: latestReadingsData } = await useFetch<ApiSuccess<{ electricity: MeterReading | null; water: MeterReading | null }>>(
  '/api/meter-readings/latest',
  { query: { room_id: id } },
)
const meterDeviceCount = computed(() => {
  const readings = latestReadingsData.value?.data
  if (!readings) return 0
  return Number(Boolean(readings.electricity)) + Number(Boolean(readings.water))
})

// Per-contract services (only loads when there's an active contract)
const activeContractId = computed(() => activeContract.value?.id ?? '')
const { data: contractServicesData, refresh: refreshContractServices } = await useFetch<ApiSuccess<ContractService[]>>(
  computed(() => activeContractId.value
    ? `/api/contract-services?contract_id=${activeContractId.value}`
    : '/api/contract-services?__skip'),
  { immediate: false },
)
watch(activeContractId, (next) => {
  if (next) refreshContractServices()
}, { immediate: true })
const contractServices = computed(() => contractServicesData.value?.data ?? [])
const loadingContractServices = computed(() => Boolean(activeContractId.value) && !contractServicesData.value)
const activeServicesCount = computed(() => contractServices.value.filter(s => s.isEnabled).length)
const monthlyServicesTotal = computed(() =>
  contractServices.value
    .filter(s => s.isEnabled)
    .reduce((sum, s) => sum + s.amount * s.quantity, 0),
)

const showServicesModal = ref(false)

async function handleContractServiceUpdate(serviceId: string, input: ContractServiceUpdateInput) {
  await apiFetch(`/api/contract-services/${serviceId}`, { method: 'PATCH', body: input })
  await refreshContractServices()
}

const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteReason = ref('')
const deleteReasonError = ref('')

interface ConflictDetails {
  activeContracts?: number
  meterReadings?: number
}

const conflictDetails = ref<ConflictDetails | null>(null)

function openDeleteModal() {
  deleteReason.value = ''
  deleteReasonError.value = ''
  showDeleteModal.value = true
}

async function confirmDelete() {
  const reason = deleteReason.value.trim()
  if (!reason) {
    deleteReasonError.value = 'Lý do xoá là bắt buộc.'
    return
  }

  deleteReasonError.value = ''
  isDeleting.value = true
  conflictDetails.value = null
  try {
    await apiFetch(`/api/rooms/${id}`, {
      method: 'DELETE',
      body: { reason },
    })
    invalidateRoomListCache()
    showDeleteModal.value = false
    await navigateTo('/dashboard/rooms')
  }
  catch (e: unknown) {
    const err = e as ApiErrorLike
    if (err.statusCode === 409 || getApiErrorCode(err) === 'CONFLICT') {
      conflictDetails.value = getApiErrorDetails<ConflictDetails>(err) ?? {}
      showDeleteModal.value = false
    }
    else {
      toast.error('Không thể xoá phòng. Vui lòng thử lại.')
    }
  }
  finally {
    isDeleting.value = false
  }
}

async function archiveInstead() {
  if (!room.value) return
  const reason = deleteReason.value.trim()
  if (!reason) {
    toast.error('Thiếu lý do xoá. Vui lòng thử lại thao tác xoá.')
    return
  }

  isDeleting.value = true
  try {
    await apiFetch(`/api/rooms/${id}`, {
      method: 'DELETE',
      query: { force: true },
      body: { reason },
    })
    invalidateRoomListCache()
    toast.success(`Đã lưu trữ phòng ${room.value.roomNumber}`)
    conflictDetails.value = null
    await refreshRoom()
  }
  catch {
    toast.error('Không thể lưu trữ phòng.')
  }
  finally {
    isDeleting.value = false
  }
}

const meterReadingsPath = computed(() => {
  if (!building.value || !room.value) return '/dashboard/billing'
  return `${buildingPath(building.value)}/meter-readings?room_id=${room.value.code}`
})

if (error.value?.statusCode === 404) {
  await navigateTo('/dashboard/rooms')
}
</script>

<template>
  <div>
    <div v-if="isLoading" class="space-y-4">
      <UiSkeleton class="h-8 w-64 rounded-lg" />
      <UiSkeleton class="h-48 rounded-xl" />
    </div>

    <UiAlert v-else-if="error && error.statusCode !== 404" severity="danger">
      Không thể tải thông tin phòng.
    </UiAlert>

    <template v-else-if="room">
      <UiPageHeader
        :title="`Phòng ${room.roomNumber}`"
        :description="building?.name"
        :back-to="'/dashboard/rooms'"
        back-label="Phòng"
      >
        <div ref="titleSentinel" aria-hidden="true" />
        <template #actions>
          <div v-if="authStore.can('rooms.update')" class="flex gap-2 shrink-0">
            <NuxtLink :to="roomEditPath(room)">
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
            <p class="text-sm font-medium text-ui-primary">Không thể xoá phòng này</p>
            <p class="mt-1 text-xs text-ui-muted">
              <template v-if="conflictDetails.activeContracts">
                Còn {{ conflictDetails.activeContracts }} hợp đồng đang hoạt động.
              </template>
              <template v-if="conflictDetails.meterReadings">
                Còn {{ conflictDetails.meterReadings }} chỉ số đồng hồ.
              </template>
              Bạn có thể lưu trữ phòng thay vì xoá vĩnh viễn.
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
        <RoomDetailHero
          :room="room"
          :building="building"
          :active-contract="activeContract"
          :occupant-count="occupantCount"
          :meter-device-count="meterDeviceCount"
        />
      </div>

      <UiSurfacePanel id="overview" as="section" class="mt-6">
        <header class="mb-2">
          <h3 class="text-sm font-semibold text-ui-primary">Tổng quan</h3>
          <p class="mt-0.5 text-xs text-ui-muted">Thông tin định danh, giá chuẩn và vị trí của phòng.</p>
        </header>
        <UiDefinitionList>
          <UiDefinitionItem label="Tòa nhà">
            <NuxtLink v-if="building" :to="buildingPath(building)" class="text-ui-accent hover:underline">
              {{ building.name }}
            </NuxtLink>
            <template v-else>{{ room.buildingId }}</template>
          </UiDefinitionItem>
          <UiDefinitionItem label="Giá chuẩn">
            <span class="font-medium">{{ formatCurrency(room.monthlyRent) }}/tháng</span>
          </UiDefinitionItem>
          <UiDefinitionItem label="Tầng" :value="room.floor" />
          <UiDefinitionItem v-if="room.area" label="Diện tích" :value="`${room.area} m²`" />
          <UiDefinitionItem label="Ngày tạo" :value="new Date(room.createdAt).toLocaleDateString('vi-VN')" />
          <UiDefinitionItem v-if="room.description" label="Mô tả" :value="room.description" stacked />
        </UiDefinitionList>
      </UiSurfacePanel>

      <UiSurfacePanel id="active-contract" as="section" class="mt-4">
        <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-ui-primary">Hợp đồng hiện tại</h3>
            <p class="mt-0.5 text-xs text-ui-muted">Trạng thái thuê và thao tác nhanh.</p>
          </div>
          <div v-if="authStore.can('contracts.create')" class="flex items-center gap-2">
            <UiButton
              v-if="!activeContract && room.status !== 'maintenance'"
              size="sm"
              @click="navigateTo(`/dashboard/contracts/create?room_id=${room.code}`)"
            >
              Giao phòng
            </UiButton>
            <UiButton
              v-else-if="activeContract"
              variant="danger"
              size="sm"
              @click="navigateTo(`${contractPath(activeContract)}#checkout`)"
            >
              Thu phòng
            </UiButton>
          </div>
        </header>

        <div v-if="activeContract" class="rounded-lg border border-ui-border bg-ui-deep/40 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <NuxtLink :to="contractPath(activeContract)" class="text-sm font-medium text-ui-primary hover:text-ui-accent">
                {{ activeContract.contractCode }}
              </NuxtLink>
              <p class="mt-1 text-sm text-ui-muted">
                {{ activeContract.tenant.fullName }} · {{ activeContract.tenant.phone }}
              </p>
              <p class="mt-1 text-xs text-ui-muted">
                {{ new Date(activeContract.startDate).toLocaleDateString('vi-VN') }}
                –
                {{ new Date(activeContract.endDate).toLocaleDateString('vi-VN') }}
                · {{ formatCurrency(activeContract.monthlyRent) }}/tháng
              </p>
            </div>
            <UiButton
              variant="secondary"
              size="sm"
              class="shrink-0 flex-col items-end text-right hover:border-ui-accent/40"
              :title="loadingContractServices ? 'Đang tải...' : 'Chỉnh dịch vụ của phòng'"
              :disabled="loadingContractServices"
              @click="showServicesModal = true"
            >
              <span class="block text-[10px] uppercase tracking-wide text-ui-muted">Dịch vụ / tháng</span>
              <span class="mt-0.5 block text-sm font-semibold text-ui-primary tabular-nums">
                {{ formatCurrency(monthlyServicesTotal) }}
              </span>
              <span class="mt-0.5 block text-[11px] text-ui-accent">
                {{ activeServicesCount }} dịch vụ active — chỉnh
              </span>
            </UiButton>
          </div>
        </div>
        <p v-else class="text-sm text-ui-muted">Phòng đang trống.</p>
      </UiSurfacePanel>

      <UiSurfacePanel id="meter-readings" as="section" class="mt-4">
        <header class="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-ui-primary">Chỉ số đồng hồ</h3>
            <p class="mt-0.5 text-xs text-ui-muted">Đi tới workspace vận hành tháng để nhập điện, nước.</p>
          </div>
          <NuxtLink :to="meterReadingsPath">
            <UiButton variant="secondary" size="sm">Nhập chỉ số tháng này</UiButton>
          </NuxtLink>
        </header>

        <UiDefinitionList>
          <UiDefinitionItem
            label="Điện gần nhất"
            :value="latestReadingsData?.data?.electricity ? `${latestReadingsData.data.electricity.readingValue.toLocaleString('vi-VN')} kWh` : 'Chưa có dữ liệu'"
          />
          <UiDefinitionItem
            label="Nước gần nhất"
            :value="latestReadingsData?.data?.water ? `${latestReadingsData.data.water.readingValue.toLocaleString('vi-VN')} m³` : 'Chưa có dữ liệu'"
          />
        </UiDefinitionList>
      </UiSurfacePanel>

      <UiSurfacePanel id="contracts-history" as="section" class="mt-4">
        <header class="mb-4">
          <h3 class="text-sm font-semibold text-ui-primary">Lịch sử hợp đồng</h3>
          <p class="mt-0.5 text-xs text-ui-muted">Tất cả hợp đồng đã từng gắn với phòng này.</p>
        </header>
        <div v-if="roomContracts.length > 0" class="divide-y divide-ui-border rounded-lg border border-ui-border bg-ui-deep/30">
          <UiListRow
            v-for="contract in roomContracts"
            :key="contract.id"
            :to="contractPath(contract)"
            compact
          >
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-xs font-medium text-ui-primary">{{ contract.tenant.fullName }}</p>
              <UiStatusBadge :status="contract.status" />
            </div>
            <p class="mt-0.5 truncate text-xs text-ui-muted">
              {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} -
              {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
              · {{ formatCurrency(contract.monthlyRent) }}/tháng
            </p>
          </UiListRow>
        </div>
        <p v-else class="text-sm text-ui-muted">Chưa có hợp đồng.</p>
      </UiSurfacePanel>

      <section
        v-if="authStore.can('rooms.delete')"
        id="danger-zone"
        class="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/5 p-6"
      >
        <h3 class="mb-2 text-sm font-semibold text-status-danger">Vùng nguy hiểm</h3>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-ui-muted">
            Xoá phòng chỉ thực hiện được khi không còn hợp đồng đang hoạt động và chưa có chỉ số đồng hồ.
          </p>
          <div class="flex items-center gap-2">
            <NuxtLink :to="roomEditPath(room)">
              <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
            </NuxtLink>
            <UiButton variant="danger" size="sm" @click="openDeleteModal">
              Xoá phòng
            </UiButton>
          </div>
        </div>
      </section>
    </template>

    <UiConfirmModal
      :open="showDeleteModal"
      title="Xác nhận xoá"
      :message="`Bạn có chắc muốn xoá phòng ${room?.roomNumber ?? ''}${building ? ` (${building.name})` : ''}? Hành động này không thể hoàn tác.`"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    >
      <div class="space-y-3">
        <p class="text-sm text-ui-muted">
          Bạn có chắc muốn xoá phòng {{ room?.roomNumber ?? '' }}{{ building ? ` (${building.name})` : '' }}?
          Hành động này không thể hoàn tác.
        </p>
        <UiTextarea
          v-model="deleteReason"
          label="Lý do xoá"
          :rows="3"
          placeholder="Ví dụ: tạo trùng phòng do thao tác nhầm"
          :error="deleteReasonError"
          @update:model-value="deleteReasonError = ''"
        />
      </div>
    </UiConfirmModal>

    <UiModal
      :open="showServicesModal && Boolean(activeContract)"
      size="xl"
      :title="activeContract
        ? `Dịch vụ — Phòng ${room?.roomNumber} · ${activeContract.tenant.fullName}`
        : 'Dịch vụ'"
      @close="showServicesModal = false"
    >
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
          <p class="text-ui-muted">
            Thay đổi chỉ ảnh hưởng phòng này. Thêm/bớt loại dịch vụ tại
            <NuxtLink
              v-if="building"
              :to="`${buildingPath(building)}/settings`"
              class="text-ui-accent hover:underline"
              @click="showServicesModal = false"
            >
              cài đặt tòa nhà
            </NuxtLink>
            <span v-else>cài đặt tòa nhà</span>.
          </p>
          <span class="rounded-md bg-ui-accent/10 px-2 py-1 text-ui-accent tabular-nums">
            {{ activeServicesCount }} active · {{ formatCurrency(monthlyServicesTotal) }}/tháng
          </span>
        </div>
        <ContractServicesTab
          :services="contractServices"
          :loading="loadingContractServices"
          @update="handleContractServiceUpdate"
        />
      </div>
      <template #footer>
        <UiButton variant="secondary" size="sm" @click="showServicesModal = false">
          Xong
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
