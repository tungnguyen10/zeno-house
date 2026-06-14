<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import { buildingPath, roomPath } from '~/utils/routes/operational'

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

const statusOptions = [
  { value: 'available', label: 'Trống' },
  { value: 'occupied', label: 'Đã có người thuê' },
  { value: 'maintenance', label: 'Đang bảo trì' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Phòng" :description="`${total} phòng`">
      <template #actions>
        <NuxtLink v-if="authStore.isAdmin" to="/rooms/create">
          <UiButton>Thêm phòng</UiButton>
        </NuxtLink>
      </template>
    </UiPageHeader>

    <UiToolbar class="mb-6">
      <UiSelect
        v-model="status"
        :options="statusOptions"
        placeholder="Tất cả trạng thái"
        class="w-full sm:w-56"
      />
    </UiToolbar>

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
    <UiAlert v-else-if="error" severity="danger">
      Không thể tải danh sách phòng. Vui lòng thử lại.
    </UiAlert>

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
            :to="buildingPath(building)"
            class="text-xs text-muted hover:text-cyan transition-colors"
          >
            Xem tòa nhà →
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <NuxtLink
            v-for="room in roomsByBuilding[building.id]"
            :key="room.id"
            :to="roomPath({ id: room.id, roomNumber: room.roomNumber, building })"
          >
            <RoomCard :room="room" />
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
