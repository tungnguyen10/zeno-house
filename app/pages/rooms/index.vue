<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'
import { roomFormToApiPayload, type RoomFormData } from '~/components/rooms/RoomForm.vue'
import type { RoomBulkAction, RoomBulkResult } from '~/composables/rooms/useRoomBulkActions'

definePageMeta({ title: 'Phòng' })

const authStore = useAuthStore()
const toast = useToast()
const {
  rooms,
  total,
  totalPages,
  page,
  q,
  status,
  sort,
  order,
  buildingId,
  floor,
  hasActiveFilters,
  resetFilters,
  isLoading,
  error,
  refresh,
} = useRoomList()

const { data: buildingsData } = await useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)
const buildings = computed(() => buildingsData.value?.data ?? [])
const buildingNameById = computed(() => new Map(buildings.value.map(b => [b.id, b.name])))

const roomsByBuilding = computed(() => {
  const byBuilding = new Map<string, typeof rooms.value>()
  for (const room of rooms.value) {
    const list = byBuilding.get(room.buildingId) ?? []
    list.push(room)
    byBuilding.set(room.buildingId, list)
  }

  const ordered: { id: string; name: string; rooms: typeof rooms.value; availableCount: number }[] = []
  const consume = (id: string, name: string) => {
    const list = byBuilding.get(id)
    if (!list?.length) return
    ordered.push({
      id,
      name,
      rooms: list,
      availableCount: list.filter(r => r.status === 'available').length,
    })
    byBuilding.delete(id)
  }
  for (const b of buildings.value) consume(b.id, b.name)
  for (const [id, list] of byBuilding) {
    ordered.push({
      id,
      name: buildingNameById.value.get(id) ?? 'Tòa nhà',
      rooms: list,
      availableCount: list.filter(r => r.status === 'available').length,
    })
  }
  return ordered
})

const bulk = useRoomBulkActions()
const selectionMode = ref(false)

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) bulk.clear()
}

function onToggleSelect(id: string) {
  bulk.toggle(id)
}

const allOnPageSelected = computed(() => {
  if (rooms.value.length === 0) return false
  return rooms.value.every(room => bulk.selectedIds.value.includes(room.id))
})

const someOnPageSelected = computed(() =>
  rooms.value.some(room => bulk.selectedIds.value.includes(room.id)),
)

function toggleAllOnPage(checked: boolean) {
  if (checked) {
    const merged = new Set([...bulk.selectedIds.value, ...rooms.value.map(room => room.id)])
    bulk.selectAll([...merged])
  }
  else {
    const pageIds = new Set(rooms.value.map(room => room.id))
    bulk.selectAll(bulk.selectedIds.value.filter(id => !pageIds.has(id)))
  }
}

const failureModalOpen = ref(false)
const lastFailures = ref<RoomBulkResult['failed']>([])
const lastFailureAction = ref<RoomBulkAction | null>(null)

const reasonLabels: Record<string, string> = {
  has_active_contracts: 'Còn hợp đồng đang hoạt động',
  has_meter_readings: 'Đã có chỉ số đồng hồ',
  not_found: 'Không tìm thấy',
  conflict: 'Xung đột dữ liệu',
}

const failuresWithName = computed(() => {
  const map = new Map(rooms.value.map(room => [room.id, `Phòng ${room.roomNumber}`]))
  return lastFailures.value.map(f => ({
    id: f.id,
    name: map.get(f.id) ?? f.id,
    reason: reasonLabels[f.reason] ?? f.reason,
  }))
})

const lastActionVerb = computed(() => {
  if (lastFailureAction.value === 'archive') return 'lưu trữ'
  if (lastFailureAction.value === 'activate') return 'đánh dấu trống'
  if (lastFailureAction.value === 'set_maintenance') return 'bảo trì'
  return 'xoá'
})

// Quick edit drawer ------------------------------------------------------------
const editingRoom = ref<Room | null>(null)
const editForm = ref<RoomFormData | null>(null)
const editLoading = ref(false)
const editError = ref('')
const editFieldErrors = ref<Record<string, string[]>>({})

function roomToForm(value: Room): RoomFormData {
  return {
    building_id: value.buildingId,
    room_number: value.roomNumber,
    floor: value.floor,
    status: value.status,
    monthly_rent: value.monthlyRent,
    area: value.area != null ? String(value.area) : '',
    description: value.description ?? '',
  }
}

function onEditRoom(room: Room) {
  editingRoom.value = room
  editForm.value = roomToForm(room)
  editError.value = ''
  editFieldErrors.value = {}
}

function closeEdit() {
  editingRoom.value = null
  editForm.value = null
  editError.value = ''
  editFieldErrors.value = {}
}

async function onSubmitEdit(data: RoomFormData) {
  if (!editingRoom.value) return
  const payload = roomFormToApiPayload(data)
  editLoading.value = true
  editError.value = ''
  editFieldErrors.value = {}
  try {
    await $fetch(`/api/rooms/${editingRoom.value.id}`, {
      method: 'PATCH',
      body: {
        room_number: payload.room_number,
        floor: payload.floor,
        status: payload.status,
        monthly_rent: payload.monthly_rent,
        area: payload.area,
        description: payload.description,
      },
    })
    toast.success(`Đã cập nhật phòng ${data.room_number}`)
    closeEdit()
    await refresh()
  }
  catch (e: unknown) {
    const err = e as { data?: { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } } }
    editError.value = err?.data?.error?.message ?? 'Không thể cập nhật phòng. Vui lòng thử lại.'
    if (err?.data?.error?.details?.fieldErrors) {
      editFieldErrors.value = err.data.error.details.fieldErrors
    }
  }
  finally {
    editLoading.value = false
  }
}

// Services drawer --------------------------------------------------------------
const servicesRoom = ref<Room | null>(null)
const servicesContract = ref<ContractWithDetails | null>(null)
const servicesList = ref<ContractService[]>([])
const servicesLoading = ref(false)
const servicesError = ref('')

async function onEditServices(room: Room) {
  servicesRoom.value = room
  servicesContract.value = null
  servicesList.value = []
  servicesError.value = ''
  servicesLoading.value = true
  try {
    const contractsRes = await $fetch<ApiSuccess<ContractWithDetails[]>>('/api/contracts', {
      query: { room_id: room.id, status: 'active', limit: 1 },
    })
    const contract = contractsRes.data?.[0] ?? null
    servicesContract.value = contract
    if (!contract) {
      servicesError.value = 'Phòng này chưa có hợp đồng active.'
      return
    }
    const servicesRes = await $fetch<ApiSuccess<ContractService[]>>(
      `/api/contract-services?contract_id=${contract.id}`,
    )
    servicesList.value = servicesRes.data ?? []
  }
  catch {
    servicesError.value = 'Không thể tải dịch vụ của phòng.'
  }
  finally {
    servicesLoading.value = false
  }
}

function closeServices() {
  servicesRoom.value = null
  servicesContract.value = null
  servicesList.value = []
  servicesError.value = ''
}

async function onUpdateService(id: string, input: ContractServiceUpdateInput) {
  await $fetch(`/api/contract-services/${id}`, { method: 'PATCH', body: input })
  if (!servicesContract.value) return
  const res = await $fetch<ApiSuccess<ContractService[]>>(
    `/api/contract-services?contract_id=${servicesContract.value.id}`,
  )
  servicesList.value = res.data ?? []
}

async function onBulkDone(result: RoomBulkResult, action: RoomBulkAction) {
  const verb = action === 'archive'
    ? 'lưu trữ'
    : action === 'activate'
      ? 'đánh dấu trống'
      : action === 'set_maintenance'
        ? 'chuyển bảo trì'
        : 'xoá'
  const succeeded = result.succeeded.length
  const failed = result.failed.length

  lastFailures.value = result.failed
  lastFailureAction.value = action

  if (succeeded > 0 && failed === 0) toast.success(`Đã ${verb} ${succeeded} phòng`)
  else if (succeeded > 0 && failed > 0) toast.info(`Đã ${verb} ${succeeded} phòng, ${failed} phòng bị bỏ qua`)
  else if (failed > 0) toast.error(`Không thể ${verb}. ${failed} phòng bị bỏ qua`)

  bulk.clear()
  await refresh()
}
</script>

<template>
  <div>
    <UiPageHeader title="Phòng" :description="`${total} phòng`">
      <template #actions>
        <div class="flex items-center gap-2">
          <UiButton
            v-if="authStore.can('rooms.delete')"
            variant="secondary"
            size="sm"
            @click="toggleSelectionMode"
          >
            {{ selectionMode ? 'Thoát chọn' : 'Chọn nhiều' }}
          </UiButton>
          <NuxtLink v-if="authStore.can('rooms.create')" to="/rooms/create">
            <UiButton>Thêm phòng</UiButton>
          </NuxtLink>
        </div>
      </template>
    </UiPageHeader>

    <RoomListToolbar
      v-model:q="q"
      v-model:status="status"
      v-model:sort="sort"
      v-model:order="order"
      v-model:building-id="buildingId"
      v-model:floor="floor"
      :has-active-filters="hasActiveFilters"
      class="mb-4"
      @reset="resetFilters"
    />

    <UiAlert v-if="lastFailures.length > 0" severity="warning" class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="text-sm">
          {{ lastFailures.length }} phòng bị bỏ qua trong lần {{ lastActionVerb }} gần nhất.
        </span>
        <div class="flex items-center gap-2">
          <UiButton size="sm" variant="secondary" @click="failureModalOpen = true">
            Xem chi tiết
          </UiButton>
          <UiButton size="sm" variant="ghost" @click="lastFailures = []">Đóng</UiButton>
        </div>
      </div>
    </UiAlert>

    <div v-if="isLoading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <UiSkeleton v-for="n in 8" :key="n" class="h-36 rounded-xl" />
    </div>

    <UiAlert v-else-if="error" severity="danger">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>Không thể tải danh sách phòng.</span>
        <UiButton variant="secondary" size="sm" @click="refresh()">Thử lại</UiButton>
      </div>
    </UiAlert>

    <UiEmptyState
      v-else-if="rooms.length === 0 && hasActiveFilters"
      variant="search"
      title="Không tìm thấy phòng phù hợp"
      description="Thử bỏ bớt bộ lọc hoặc thay đổi từ khoá tìm kiếm."
    >
      <template #action>
        <UiButton variant="secondary" @click="resetFilters">Xoá bộ lọc</UiButton>
      </template>
    </UiEmptyState>

    <UiEmptyState
      v-else-if="rooms.length === 0"
      title="Chưa có phòng nào"
      description="Bắt đầu bằng cách thêm phòng đầu tiên."
    >
      <template v-if="authStore.can('rooms.create')" #action>
        <NuxtLink to="/rooms/create">
          <UiButton>Thêm phòng đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <template v-else>
      <div
        v-if="selectionMode && authStore.can('rooms.delete')"
        class="mb-3 flex items-center justify-between gap-3 rounded-lg border border-dark-border bg-dark-deep/40 px-3 py-2"
      >
        <UiCheckbox
          :model-value="allOnPageSelected"
          :indeterminate="someOnPageSelected && !allOnPageSelected"
          :label="`Chọn cả trang (${rooms.length})`"
          @update:model-value="toggleAllOnPage"
        />
        <span class="text-xs text-muted">{{ bulk.selectedIds.value.length }} đã chọn tổng cộng</span>
      </div>

      <div class="space-y-6">
        <section
          v-for="group in roomsByBuilding"
          :key="group.id"
          :aria-labelledby="`building-group-${group.id}`"
        >
          <header class="mb-3 flex items-baseline justify-between gap-3 border-b border-dark-border pb-2">
            <h2
              :id="`building-group-${group.id}`"
              class="text-sm font-semibold uppercase tracking-wide text-white"
            >
              {{ group.name }}
            </h2>
            <p class="text-xs text-muted">
              {{ group.rooms.length }} phòng
              <span v-if="group.availableCount > 0">
                · <span class="text-success-neon">{{ group.availableCount }} trống</span>
              </span>
            </p>
          </header>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <RoomCard
              v-for="room in group.rooms"
              :key="room.id"
              :room="room"
              :selectable="selectionMode && authStore.can('rooms.delete')"
              :selected="bulk.selectedIds.value.includes(room.id)"
              @toggle-select="onToggleSelect"
              @edit="onEditRoom"
              @edit-services="onEditServices"
            />
          </div>
        </section>
      </div>

      <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between border-t border-dark-border pt-4">
        <p class="text-sm text-muted">Trang {{ page }} / {{ totalPages }}</p>
        <div class="flex gap-2">
          <UiButton variant="secondary" size="sm" :disabled="page <= 1" @click="page--">
            Trước
          </UiButton>
          <UiButton variant="secondary" size="sm" :disabled="page >= totalPages" @click="page++">
            Tiếp
          </UiButton>
        </div>
      </div>
    </template>

    <RoomBulkActionsBar
      v-if="selectionMode && authStore.can('rooms.delete') && bulk.selectedIds.value.length > 0"
      :selected-ids="bulk.selectedIds.value"
      :rooms="rooms"
      :run-action="bulk.runAction"
      :is-running="bulk.isRunning.value"
      class="mt-6"
      @clear="bulk.clear"
      @done="onBulkDone"
    />

    <UiModal
      :open="failureModalOpen"
      :title="`Chi tiết ${failuresWithName.length} phòng bị bỏ qua`"
      size="lg"
      @close="failureModalOpen = false"
    >
      <ul class="space-y-2 text-sm">
        <li
          v-for="row in failuresWithName"
          :key="row.id"
          class="flex items-start justify-between gap-3 rounded-lg border border-dark-border bg-dark-deep/40 px-3 py-2"
        >
          <span class="font-medium text-white">{{ row.name }}</span>
          <span class="text-xs text-muted">{{ row.reason }}</span>
        </li>
      </ul>
      <template #footer>
        <UiButton variant="secondary" @click="failureModalOpen = false">Đóng</UiButton>
      </template>
    </UiModal>

    <UiDrawer
      :model-value="editingRoom !== null"
      :title="editingRoom ? `Chỉnh sửa · Phòng ${editingRoom.roomNumber}` : 'Chỉnh sửa phòng'"
      width="w-full sm:w-[480px]"
      @update:model-value="(open) => { if (!open) closeEdit() }"
    >
      <UiAlert v-if="editError" severity="danger" class="mb-4">
        {{ editError }}
      </UiAlert>

      <RoomForm
        v-if="editForm"
        v-model="editForm"
        :loading="editLoading"
        :errors="editFieldErrors"
        :is-dirty="true"
        submit-label="Cập nhật"
        @submit="onSubmitEdit"
        @cancel="closeEdit"
      />
    </UiDrawer>

    <UiDrawer
      :model-value="servicesRoom !== null"
      :title="servicesRoom ? `Dịch vụ · Phòng ${servicesRoom.roomNumber}` : 'Dịch vụ của phòng'"
      width="w-full sm:w-[640px]"
      @update:model-value="(open) => { if (!open) closeServices() }"
    >
      <p v-if="servicesContract" class="mb-4 text-xs text-muted">
        Hợp đồng <span class="text-white">{{ servicesContract.contractCode }}</span>
        <span v-if="servicesContract.tenant?.fullName"> · {{ servicesContract.tenant.fullName }}</span>
      </p>
      <UiAlert v-if="servicesError" severity="warning" class="mb-4">
        {{ servicesError }}
      </UiAlert>
      <ContractServicesTab
        v-if="servicesContract"
        :services="servicesList"
        :loading="servicesLoading"
        @update="onUpdateService"
      />
      <div v-else-if="servicesLoading" class="space-y-2">
        <UiSkeleton v-for="n in 4" :key="n" class="h-12 rounded-lg" />
      </div>
    </UiDrawer>
  </div>
</template>
