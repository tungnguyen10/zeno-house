<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import { formatCurrency } from '~/utils/format/currency'

definePageMeta({ title: 'Chi tiết phòng' })

const route = useRoute()
const authStore = useAuthStore()
const id = route.params.id as string

const { room, isLoading, error } = useRoomDetail(id)

// Fetch building for display context — only after room is known
const buildingId = computed(() => room.value?.buildingId ?? '')
const { data: buildingData } = await useFetch<ApiSuccess<Building>>(
  computed(() => `/api/buildings/${buildingId.value}`),
  { immediate: false, watch: [buildingId] },
)
const building = computed(() => buildingData.value?.data ?? null)

const showDeleteModal = ref(false)
const isDeleting = ref(false)

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
    </template>

    <!-- Delete modal -->
    <UiModal :open="showDeleteModal" title="Xác nhận xoá" @close="showDeleteModal = false">
      <template #default>
        <p class="text-sm text-muted">
          Bạn có chắc muốn xoá phòng <strong class="text-white">{{ room?.roomNumber }}</strong>? Hành động này không thể hoàn tác.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UiButton variant="secondary" @click="showDeleteModal = false">Huỷ</UiButton>
          <UiButton variant="danger" :loading="isDeleting" @click="confirmDelete">Xoá</UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>
