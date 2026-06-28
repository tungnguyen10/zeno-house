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

const buildingId = computed(() => room.value?.buildingId ?? '')
const { data: buildingData, refresh: refreshBuilding } = await useFetch<ApiSuccess<Building>>(
  computed(() => buildingId.value ? `/api/buildings/${buildingId.value}` : '/api/buildings/__missing'),
  { immediate: false },
)
watch(buildingId, () => {
  if (buildingId.value) refreshBuilding()
}, { immediate: true })
const building = computed(() => buildingData.value?.data ?? null)

const { data: contractsData, refresh: refreshContracts } = await useFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>(
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
  await $fetch(`/api/contract-services/${serviceId}`, { method: 'PATCH', body: input })
  await refreshContractServices()
}

const showDeleteModal = ref(false)
const isDeleting = ref(false)

const showTerminateModal = ref(false)
const isTerminating = ref(false)

interface ConflictDetails {
  activeContracts?: number
  meterReadings?: number
}

const conflictDetails = ref<ConflictDetails | null>(null)

async function confirmDelete() {
  isDeleting.value = true
  conflictDetails.value = null
  try {
    await $fetch(`/api/rooms/${id}`, { method: 'DELETE' })
    showDeleteModal.value = false
    await navigateTo('/rooms')
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
      toast.error('Không thể xoá phòng. Vui lòng thử lại.')
    }
  }
  finally {
    isDeleting.value = false
  }
}

async function archiveInstead() {
  if (!room.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/rooms/${id}`, {
      method: 'DELETE',
      query: { force: true },
    })
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

async function confirmTerminate() {
  if (!activeContract.value) return
  isTerminating.value = true
  try {
    await $fetch(`/api/contracts/${activeContract.value.id}`, {
      method: 'PATCH',
      body: { status: 'terminated' },
    })
    showTerminateModal.value = false
    await Promise.all([refreshContracts(), refreshRoom()])
  }
  finally {
    isTerminating.value = false
  }
}

const meterReadingsPath = computed(() => {
  if (!building.value || !room.value) return '/billing'
  return `${buildingPath(building.value)}/meter-readings?room_id=${room.value.code}`
})

if (error.value?.statusCode === 404) {
  await navigateTo('/rooms')
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
      <UiPageHeader :title="`Phòng ${room.roomNumber}`" :description="building?.name">
        <template #actions>
          <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
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
            <p class="text-sm font-medium text-white">Không thể xoá phòng này</p>
            <p class="mt-1 text-xs text-muted">
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

      <section id="overview" class="mt-6 rounded-xl border border-dark-border bg-dark-surface p-6">
        <header class="mb-4">
          <h3 class="text-sm font-semibold text-white">Tổng quan</h3>
          <p class="mt-0.5 text-xs text-muted">Thông tin định danh, giá chuẩn và vị trí của phòng.</p>
        </header>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p class="mb-1 text-xs text-muted">Tòa nhà</p>
            <NuxtLink v-if="building" :to="buildingPath(building)" class="text-sm text-cyan hover:underline">
              Tòa nhà: {{ building.name }}
            </NuxtLink>
            <p v-else class="text-sm text-white">{{ room.buildingId }}</p>
          </div>
          <div>
            <p class="mb-1 text-xs text-muted">Giá chuẩn</p>
            <p class="text-sm font-medium text-white">{{ formatCurrency(room.monthlyRent) }}/tháng</p>
          </div>
          <div>
            <p class="mb-1 text-xs text-muted">Tầng</p>
            <p class="text-sm text-white">{{ room.floor }}</p>
          </div>
          <div v-if="room.area">
            <p class="mb-1 text-xs text-muted">Diện tích</p>
            <p class="text-sm text-white">{{ room.area }} m²</p>
          </div>
          <div>
            <p class="mb-1 text-xs text-muted">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(room.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
        </div>
        <div v-if="room.description" class="mt-4">
          <p class="mb-1 text-xs text-muted">Mô tả</p>
          <p class="text-sm text-white">{{ room.description }}</p>
        </div>
      </section>

      <section id="active-contract" class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6">
        <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-white">Hợp đồng hiện tại</h3>
            <p class="mt-0.5 text-xs text-muted">Trạng thái thuê và thao tác nhanh.</p>
          </div>
          <div v-if="authStore.isAdmin" class="flex items-center gap-2">
            <UiButton
              v-if="!activeContract && room.status !== 'maintenance'"
              size="sm"
              @click="navigateTo(`/contracts/create?room_id=${room.code}`)"
            >
              Giao phòng
            </UiButton>
            <UiButton
              v-else-if="activeContract"
              variant="danger"
              size="sm"
              @click="showTerminateModal = true"
            >
              Thu phòng
            </UiButton>
          </div>
        </header>

        <div v-if="activeContract" class="rounded-lg border border-dark-border bg-dark-deep/40 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <NuxtLink :to="contractPath(activeContract)" class="text-sm font-medium text-white hover:text-cyan">
                {{ activeContract.contractCode }}
              </NuxtLink>
              <p class="mt-1 text-sm text-muted">
                {{ activeContract.tenant.fullName }} · {{ activeContract.tenant.phone }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ new Date(activeContract.startDate).toLocaleDateString('vi-VN') }}
                –
                {{ new Date(activeContract.endDate).toLocaleDateString('vi-VN') }}
                · {{ formatCurrency(activeContract.monthlyRent) }}/tháng
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-right hover:border-cyan/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/30"
              :title="loadingContractServices ? 'Đang tải...' : 'Chỉnh dịch vụ của phòng'"
              :disabled="loadingContractServices"
              @click="showServicesModal = true"
            >
              <span class="block text-[10px] uppercase tracking-wide text-muted">Dịch vụ / tháng</span>
              <span class="mt-0.5 block text-sm font-semibold text-white tabular-nums">
                {{ formatCurrency(monthlyServicesTotal) }}
              </span>
              <span class="mt-0.5 block text-[11px] text-cyan">
                {{ activeServicesCount }} dịch vụ active — chỉnh
              </span>
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-muted">Phòng đang trống.</p>
      </section>

      <section id="meter-readings" class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6">
        <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-white">Chỉ số đồng hồ</h3>
            <p class="mt-0.5 text-xs text-muted">Đi tới workspace vận hành tháng để nhập điện, nước.</p>
          </div>
          <NuxtLink :to="meterReadingsPath">
            <UiButton variant="secondary" size="sm">Nhập chỉ số tháng này</UiButton>
          </NuxtLink>
        </header>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-dark-border bg-dark-deep/40 p-4">
            <p class="text-xs text-muted">Điện gần nhất</p>
            <p class="mt-1 text-sm text-white">
              {{ latestReadingsData?.data?.electricity ? `${latestReadingsData.data.electricity.readingValue.toLocaleString('vi-VN')} kWh` : 'Chưa có dữ liệu' }}
            </p>
          </div>
          <div class="rounded-lg border border-dark-border bg-dark-deep/40 p-4">
            <p class="text-xs text-muted">Nước gần nhất</p>
            <p class="mt-1 text-sm text-white">
              {{ latestReadingsData?.data?.water ? `${latestReadingsData.data.water.readingValue.toLocaleString('vi-VN')} m³` : 'Chưa có dữ liệu' }}
            </p>
          </div>
        </div>
      </section>

      <section id="contracts-history" class="mt-4 rounded-xl border border-dark-border bg-dark-surface p-6">
        <header class="mb-4">
          <h3 class="text-sm font-semibold text-white">Lịch sử hợp đồng</h3>
          <p class="mt-0.5 text-xs text-muted">Tất cả hợp đồng đã từng gắn với phòng này.</p>
        </header>
        <div v-if="roomContracts.length > 0" class="divide-y divide-dark-border rounded-lg border border-dark-border bg-dark-deep/30">
          <UiListRow
            v-for="contract in roomContracts"
            :key="contract.id"
            :to="contractPath(contract)"
            compact
          >
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-xs font-medium text-white">{{ contract.tenant.fullName }}</p>
              <UiStatusBadge :status="contract.status" />
            </div>
            <p class="mt-0.5 truncate text-xs text-muted">
              {{ new Date(contract.startDate).toLocaleDateString('vi-VN') }} -
              {{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}
              · {{ formatCurrency(contract.monthlyRent) }}/tháng
            </p>
          </UiListRow>
        </div>
        <p v-else class="text-sm text-muted">Chưa có hợp đồng.</p>
      </section>

      <section
        v-if="authStore.isAdmin"
        id="danger-zone"
        class="mt-4 rounded-xl border border-error/30 bg-error/5 p-6"
      >
        <h3 class="mb-2 text-sm font-semibold text-error">Vùng nguy hiểm</h3>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-muted">
            Xoá phòng chỉ thực hiện được khi không còn hợp đồng đang hoạt động và chưa có chỉ số đồng hồ.
          </p>
          <div class="flex items-center gap-2">
            <NuxtLink :to="roomEditPath(room)">
              <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
            </NuxtLink>
            <UiButton variant="danger" size="sm" @click="showDeleteModal = true">
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
    />

    <UiConfirmModal
      :open="showTerminateModal"
      title="Xác nhận thu phòng"
      :message="`Bạn có chắc muốn thu phòng ${room?.roomNumber ?? ''}? Hợp đồng của ${activeContract?.tenant.fullName ?? 'khách thuê'} sẽ được thanh lý.`"
      confirm-label="Thu phòng"
      :loading="isTerminating"
      @confirm="confirmTerminate"
      @cancel="showTerminateModal = false"
    />

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
          <p class="text-muted">
            Thay đổi chỉ ảnh hưởng phòng này. Thêm/bớt loại dịch vụ tại
            <NuxtLink
              v-if="building"
              :to="`${buildingPath(building)}/settings`"
              class="text-cyan hover:underline"
              @click="showServicesModal = false"
            >
              cài đặt tòa nhà
            </NuxtLink>
            <span v-else>cài đặt tòa nhà</span>.
          </p>
          <span class="rounded-md bg-cyan/10 px-2 py-1 text-cyan tabular-nums">
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
