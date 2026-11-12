<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import type { Room } from '~/types/rooms'
import type { InventoryItem } from '~/types/inventory'
import { buildingSettingsPath } from '~/utils/routes/operational'

const route = useRoute()
const authStore = useAuthStore()
const id = route.params.id as string

const preview = useQuickRoomPreview()
preview.enabled.value = true

const { data: buildingData } = await useFetch<ApiSuccess<Building>>(() => `/api/buildings/${encodeURIComponent(id)}`)
const building = computed(() => buildingData.value?.data ?? null)

const { data: roomsData } = await useFetch<ApiSuccess<Room[]> & { meta?: { total?: number } }>(
  '/api/rooms',
  { query: { building_id: id, limit: 200 } },
)
watchEffect(() => {
  preview.existingRoomNumbers.value = (roomsData.value?.data ?? []).map(room => room.roomNumber)
})

const { data: templateData } = await useFetch<ApiSuccess<InventoryItem[]>>(
  () => `/api/buildings/${encodeURIComponent(id)}/inventory-template`,
)
const templateCount = computed(() => templateData.value?.data?.length ?? 0)

const applyInventory = ref(false)
watch(templateCount, (n) => { if (n === 0) applyInventory.value = false })

const { submit, loading, apiError, duplicateRoomNumbers } = useRoomBatchCreate(id)
watch(duplicateRoomNumbers, value => preview.markServerDuplicates(value))

const canCreate = computed(() => authStore.can('rooms.create'))

async function onSubmit() {
  if (preview.duplicateRoomNumbers.value.length > 0) return
  const rooms = preview.toPayload()
  if (rooms.length === 0) return
  await submit({ rooms, apply_inventory: applyInventory.value })
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm phòng hàng loạt"
      :description="building ? `Tạo thêm phòng cho ${building.name}` : 'Tạo thêm phòng theo dải tầng'"
      :back-to="building ? buildingSettingsPath(building) : '/dashboard/buildings'"
      back-label="Cài đặt tòa nhà"
    />

    <UiAlert v-if="!canCreate" severity="warning" class="mb-4">
      Bạn không có quyền tạo phòng cho tòa nhà này.
    </UiAlert>
    <UiAlert v-else-if="apiError" severity="danger" class="mb-4">{{ apiError }}</UiAlert>

    <div v-if="canCreate" class="space-y-5">
      <RoomBatchGenerator :preview="preview" />

      <div class="rounded-lg border border-ui-border p-3">
        <UiCheckbox
          v-model="applyInventory"
          :disabled="templateCount === 0"
          :label="`Áp dụng nội thất mẫu (${templateCount} món)`"
        />
        <p v-if="templateCount === 0" class="mt-1 text-xs text-ui-muted">
          Tòa nhà chưa có nội thất mẫu.
          <NuxtLink v-if="building" :to="`${buildingSettingsPath(building)}#inventory-template`" class="text-ui-accent underline">
            Thiết lập nội thất mẫu
          </NuxtLink>
        </p>
      </div>

      <div class="flex justify-end gap-2">
        <UiButton variant="secondary" @click="navigateTo(building ? buildingSettingsPath(building) : '/dashboard/buildings')">
          Hủy
        </UiButton>
        <UiButton
          :loading="loading"
          :disabled="preview.toPayload().length === 0 || preview.duplicateRoomNumbers.value.length > 0"
          @click="onSubmit"
        >
          Tạo {{ preview.toPayload().length }} phòng
        </UiButton>
      </div>
    </div>
  </div>
</template>
