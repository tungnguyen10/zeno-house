<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

definePageMeta({ title: 'Phòng' })

const authStore = useAuthStore()
const { rooms, total, isLoading, error, status } = useRoomList()

const { data: buildingsData } = await useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)
const buildings = computed(() => buildingsData.value?.data ?? [])

const roomsByBuilding = computed(() => {
  const groups: Record<string, typeof rooms.value> = {}
  for (const room of rooms.value) {
    if (!groups[room.buildingId]) groups[room.buildingId] = []
    groups[room.buildingId]!.push(room)
  }
  return groups
})

const buildingsWithRooms = computed(() =>
  buildings.value.filter(b => (roomsByBuilding.value[b.id]?.length ?? 0) > 0),
)
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

    <!-- Status filter -->
    <div class="flex flex-wrap gap-3 mb-6">
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
    <div v-if="isLoading" class="space-y-8">
      <div v-for="n in 2" :key="n">
        <UiSkeleton class="h-5 w-32 rounded mb-3" />
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <UiSkeleton v-for="m in 4" :key="m" class="h-32 rounded-xl" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-sm text-error p-4 rounded-lg bg-error/10 border border-error/20">
      Không thể tải danh sách phòng. Vui lòng thử lại.
    </div>

    <!-- Empty -->
    <UiEmptyState
      v-else-if="buildingsWithRooms.length === 0"
      title="Chưa có phòng nào"
      description="Bắt đầu bằng cách thêm phòng đầu tiên."
    >
      <template v-if="authStore.isAdmin" #action>
        <NuxtLink to="/rooms/create">
          <UiButton>Thêm phòng đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <!-- Grouped by building -->
    <div v-else class="space-y-8">
      <section v-for="building in buildingsWithRooms" :key="building.id">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-white">{{ building.name }}</h2>
            <span class="text-xs text-muted">
              {{ roomsByBuilding[building.id]?.length }} phòng
            </span>
          </div>
          <NuxtLink
            :to="`/buildings/${building.id}`"
            class="text-xs text-muted hover:text-cyan transition-colors"
          >
            Xem tòa nhà →
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <NuxtLink
            v-for="room in roomsByBuilding[building.id]"
            :key="room.id"
            :to="`/rooms/${room.id}`"
          >
            <RoomCard :room="room" />
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
