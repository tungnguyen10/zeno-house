<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import { formatCurrency } from '~/utils/format/currency'

definePageMeta({ title: 'Chi tiết phòng' })

const route = useRoute()
const authStore = useAuthStore()
const id = route.params.id as string

const { room, isLoading, error, refresh: refreshRoom } = useRoomDetail(id)

// Fetch building for display context — only after room is known
const buildingId = computed(() => room.value?.buildingId ?? '')
const { data: buildingData } = await useFetch<ApiSuccess<Building>>(
  computed(() => `/api/buildings/${buildingId.value}`),
  { immediate: false, watch: [buildingId] },
)
const building = computed(() => buildingData.value?.data ?? null)

// Contracts
const { data: contractsData, refresh: refreshContracts } = await useFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>(
  '/api/contracts',
  { query: { room_id: id, limit: 50 } },
)
const roomContracts = computed(() => contractsData.value?.data ?? [])
const activeContract = computed(() => roomContracts.value.find(c => c.status === 'active') ?? null)

const showDeleteModal = ref(false)
const isDeleting = ref(false)

const showTerminateModal = ref(false)
const isTerminating = ref(false)

async function confirmDelete() {
  isDeleting.value = true
  try {
    await $fetch(`/api/rooms/${id}`, { method: 'DELETE' })
    await navigateTo('/rooms')
  }
  finally {
    isDeleting.value = false
    showDeleteModal.value = false
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

if (error.value?.statusCode === 404) {
  await navigateTo('/rooms')
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
    <div v-else-if="error && error.statusCode !== 404" class="text-sm text-error p-4 rounded-lg bg-error/10 border border-error/20">
      Không thể tải thông tin phòng.
    </div>

    <!-- Detail -->
    <template v-else-if="room">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <NuxtLink to="/rooms" class="text-sm text-muted hover:text-white transition-colors">
            ← Danh sách phòng
          </NuxtLink>
          <h1 class="text-xl font-semibold text-white mt-2">Phòng {{ room.roomNumber }}</h1>
          <p v-if="building" class="text-sm text-muted mt-0.5">{{ building.name }}</p>
        </div>
        <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
          <NuxtLink :to="`/rooms/${room.id}/edit`">
            <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
          </NuxtLink>
          <UiButton variant="danger" size="sm" @click="showDeleteModal = true">Xoá</UiButton>
        </div>
      </div>

      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Trạng thái</p>
            <UiStatusBadge :status="room.status" />
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Tầng</p>
            <p class="text-sm text-white">{{ room.floor }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Giá thuê / tháng</p>
            <p class="text-sm text-white font-medium">{{ formatCurrency(activeContract?.monthlyRent ?? room.monthlyRent) }}</p>
            <p v-if="activeContract && activeContract.monthlyRent !== room.monthlyRent" class="text-xs text-muted mt-0.5">
              Theo hợp đồng đang hiệu lực
            </p>
          </div>
          <div v-if="room.area">
            <p class="text-xs text-muted mb-1">Diện tích</p>
            <p class="text-sm text-white">{{ room.area }} m²</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(room.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
        </div>
        <div v-if="room.description">
          <p class="text-xs text-muted mb-1">Mô tả</p>
          <p class="text-sm text-white">{{ room.description }}</p>
        </div>
      </div>

      <!-- Occupancy section -->
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-white">Khách thuê hiện tại</h2>
          <div v-if="authStore.isAdmin">
            <UiButton
              v-if="!activeContract && room.status !== 'maintenance'"
              size="sm"
              @click="navigateTo(`/contracts/create?room_id=${id}`)"
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
        </div>
        <div v-if="activeContract">
          <div class="text-sm text-white">
            <NuxtLink :to="`/tenants/${activeContract.tenant.id}`" class="font-medium hover:text-cyan transition-colors">
              {{ activeContract.tenant.fullName }}
            </NuxtLink>
          </div>
          <p class="text-sm text-muted mt-0.5">{{ activeContract.tenant.phone }}</p>
          <p class="text-xs text-muted mt-1">Từ ngày {{ new Date(activeContract.startDate).toLocaleDateString('vi-VN') }}</p>
        </div>
        <p v-else class="text-sm text-muted">Phòng trống</p>
      </div>

      <!-- Contracts section -->
      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-white">Hợp đồng</h2>
          <NuxtLink v-if="authStore.isAdmin" to="/contracts/create" class="text-xs text-cyan hover:underline">
            + Thêm
          </NuxtLink>
        </div>
        <div v-if="roomContracts.length > 0" class="space-y-2">
          <NuxtLink
            v-for="contract in roomContracts"
            :key="contract.id"
            :to="`/contracts/${contract.id}`"
            class="flex items-center justify-between rounded-lg border border-dark-border px-3 py-2 hover:border-cyan/40 transition-colors"
          >
            <div>
              <div class="flex items-center gap-2">
                <p class="text-xs font-medium text-white">{{ contract.tenant.fullName }}</p>
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
      :message="`Bạn có chắc muốn xoá phòng ${room?.roomNumber ?? ''}${building ? ` (${building.name})` : ''}? Hành động này không thể hoàn tác.`"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />

    <!-- Terminate contract confirm modal -->
    <UiConfirmModal
      :open="showTerminateModal"
      title="Xác nhận thu phòng"
      :message="`Bạn có chắc muốn thu phòng ${room?.roomNumber ?? ''}? Hợp đồng của ${activeContract?.tenant.fullName ?? 'khách thuê'} sẽ được thanh lý.`"
      confirm-label="Thu phòng"
      :loading="isTerminating"
      @confirm="confirmTerminate"
      @cancel="showTerminateModal = false"
    />
  </div>
</template>
