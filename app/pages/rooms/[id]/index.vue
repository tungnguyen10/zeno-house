<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { AssignInput } from '~/utils/validators/room-assignments'
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

// Room assignment
const { assignment, assign, unassign } = useRoomAssignment(id)

const showDeleteModal = ref(false)
const isDeleting = ref(false)

const showAssignModal = ref(false)
const isAssigning = ref(false)

const showUnassignModal = ref(false)
const isUnassigning = ref(false)

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

async function handleAssign(input: AssignInput) {
  isAssigning.value = true
  try {
    await assign(input)
    showAssignModal.value = false
    await refreshRoom()
  }
  finally {
    isAssigning.value = false
  }
}

async function confirmUnassign() {
  if (!assignment.value) return
  isUnassigning.value = true
  try {
    await unassign(assignment.value.id)
    showUnassignModal.value = false
    await refreshRoom()
  }
  finally {
    isUnassigning.value = false
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
            <p class="text-sm text-white font-medium">{{ formatCurrency(room.monthlyRent) }}</p>
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
              v-if="!assignment"
              size="sm"
              @click="showAssignModal = true"
            >
              Giao phòng
            </UiButton>
            <UiButton
              v-else
              variant="danger"
              size="sm"
              @click="showUnassignModal = true"
            >
              Thu phòng
            </UiButton>
          </div>
        </div>
        <div v-if="assignment">
          <div class="text-sm text-white">
            <NuxtLink :to="`/tenants/${assignment.tenant.id}`" class="font-medium hover:text-cyan transition-colors">
              {{ assignment.tenant.fullName }}
            </NuxtLink>
          </div>
          <p class="text-sm text-muted mt-0.5">{{ assignment.tenant.phone }}</p>
          <p class="text-xs text-muted mt-1">Từ ngày {{ new Date(assignment.startDate).toLocaleDateString('vi-VN') }}</p>
        </div>
        <p v-else class="text-sm text-muted">Phòng trống</p>
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

    <!-- Assign modal -->
    <RoomAssignModal
      :open="showAssignModal"
      :room-id="id"
      :loading="isAssigning"
      @assign="handleAssign"
      @cancel="showAssignModal = false"
    />

    <!-- Unassign confirm modal -->
    <UiConfirmModal
      :open="showUnassignModal"
      title="Xác nhận thu phòng"
      :message="`Bạn có chắc muốn thu phòng ${room?.roomNumber ?? ''}? Khách thuê ${assignment?.tenant.fullName ?? ''} sẽ được đánh dấu rời phòng hôm nay.`"
      confirm-label="Thu phòng"
      :loading="isUnassigning"
      @confirm="confirmUnassign"
      @cancel="showUnassignModal = false"
    />
  </div>
</template>
