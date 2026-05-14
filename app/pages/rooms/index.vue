<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

definePageMeta({ title: 'Phòng' })

const authStore = useAuthStore()
const { rooms, total, isLoading, error, buildingId, status } = useRoomList()

const { data: buildingsData } = await useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)
const buildings = computed(() => buildingsData.value?.data ?? [])
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-white">Phòng</h1>
        <p class="text-sm text-muted mt-0.5">{{ total }} phòng</p>
      </div>
      <NuxtLink v-if="authStore.isAdmin" to="/rooms/create">
        <UiButton>Thêm phòng</UiButton>
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <select
        v-model="buildingId"
        class="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
      >
        <option :value="undefined">Tất cả tòa nhà</option>
        <option v-for="b in buildings" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>

      <select
        v-model="status"
        class="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
      >
        <option :value="undefined">Tất cả trạng thái</option>
        <option value="available">Trống</option>
        <option value="occupied">Đã có người thuê</option>
        <option value="maintenance">Đang bảo trì</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <UiSkeleton v-for="n in 6" :key="n" class="h-36 rounded-xl" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-sm text-error p-4 rounded-lg bg-error/10 border border-error/20">
      Không thể tải danh sách phòng. Vui lòng thử lại.
    </div>

    <!-- Empty -->
    <UiEmptyState
      v-else-if="rooms.length === 0"
      title="Chưa có phòng nào"
      description="Bắt đầu bằng cách thêm phòng đầu tiên."
    >
      <template v-if="authStore.isAdmin" #action>
        <NuxtLink to="/rooms/create">
          <UiButton>Thêm phòng đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink v-for="room in rooms" :key="room.id" :to="`/rooms/${room.id}`">
        <RoomCard
          :room="room"
          :building-name="buildings.find(b => b.id === room.buildingId)?.name"
        />
      </NuxtLink>
    </div>
  </div>
</template>
