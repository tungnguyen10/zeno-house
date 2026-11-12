<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import { buildingPath, buildingSettingsPath } from '~/utils/routes/operational'

const route = useRoute()
const id = route.params.id as string
const authStore = useAuthStore()

const { building, isLoading: loadingBuilding, error: buildingError } = useBuildingDetail(id)
const preview = useQuickRoomPreview()
const { submit, loading, apiError, duplicateRoomNumbers } = useRoomBatchCreate(id)
const template = useInventoryTemplate(id)
const applyInventory = ref(false)
const loadingRooms = ref(true)
const roomsError = ref<string | null>(null)
const submitError = ref<string | null>(null)

const canCreate = computed(() => authStore.can('rooms.create'))
const templateCount = computed(() => template.items.value.length)
const templateSummary = computed(() => `Áp dụng nội thất mẫu (${templateCount.value} món)`)

async function loadExistingRooms() {
  loadingRooms.value = true
  roomsError.value = null
  try {
    const numbers: string[] = []
    let page = 1
    let total = Infinity
    while (numbers.length < total) {
      const res = await apiFetch<ApiSuccess<Room[]> & { meta: { total: number } }>('/api/rooms', {
        query: { building_id: id, limit: 200, page, status: ['available', 'occupied', 'maintenance', 'archived'] },
      })
      total = res.meta.total
      numbers.push(...res.data.map(room => room.roomNumber))
      if (res.data.length === 0) break
      page++
    }
    preview.existingRoomNumbers.value = numbers
  }
  catch {
    roomsError.value = 'Không tải được danh sách phòng hiện có. Tải lại trang để tránh tạo trùng mã phòng.'
  }
  finally {
    loadingRooms.value = false
  }
}

onMounted(async () => {
  preview.enabled.value = true
  await Promise.all([loadExistingRooms(), template.load()])
})

watch(duplicateRoomNumbers, value => preview.markServerDuplicates(value))

const newRoomCount = computed(() => preview.rows.value.filter(row => !row.existing).length)

async function onSubmit() {
  submitError.value = null
  if (loading.value || preview.duplicateRoomNumbers.value.length > 0) return
  let rooms
  try {
    rooms = preview.toPayload()
  }
  catch (e: unknown) {
    submitError.value = e instanceof Error ? e.message : 'Danh sách phòng không hợp lệ.'
    return
  }
  if (rooms.length === 0) {
    submitError.value = 'Không có phòng mới để tạo.'
    return
  }
  await submit({ rooms, apply_inventory: applyInventory.value && templateCount.value > 0 })
}
</script>

<template>
  <div class="min-w-0">
    <UiPageHeader
      title="Thêm phòng hàng loạt"
      :description="building?.name"
      :back-to="building ? buildingPath(building) : `/dashboard/buildings/${id}`"
      back-label="Quay lại tòa nhà"
    />

    <UiSkeleton v-if="loadingBuilding" class="h-48 rounded-xl" />
    <UiAlert v-else-if="buildingError" severity="danger">
      Không thể tải thông tin tòa nhà.
    </UiAlert>
    <UiAlert v-else-if="!canCreate" severity="warning">
      Bạn không có quyền tạo phòng.
    </UiAlert>

    <form v-else class="space-y-5" @submit.prevent="onSubmit">
      <UiAlert v-if="roomsError" severity="warning">
        {{ roomsError }}
      </UiAlert>
      <UiAlert v-if="apiError || submitError" severity="danger">
        {{ apiError || submitError }}
      </UiAlert>

      <UiFormSection
        title="Quy tắc tạo phòng"
        description="Các mã phòng đã tồn tại trong tòa nhà được đánh dấu và không bị tạo lại."
      >
        <UiSkeleton v-if="loadingRooms" class="h-32 rounded-xl" />
        <RoomBatchGenerator v-else :preview="preview" :disabled="loading" />
      </UiFormSection>

      <UiFormSection title="Nội thất" description="Sao chép danh sách nội thất mẫu của tòa nhà vào từng phòng mới.">
        <UiCheckbox
          v-model="applyInventory"
          :label="templateSummary"
          :disabled="loading || templateCount === 0"
        />
        <p v-if="templateCount === 0 && !template.loading.value" class="mt-2 text-xs text-ui-muted">
          Tòa nhà chưa có nội thất mẫu.
          <NuxtLink v-if="building" :to="`${buildingSettingsPath(building)}#inventory-template`" class="text-ui-accent hover:text-ui-accent/80">
            Khai báo trong cài đặt
          </NuxtLink>
        </p>
      </UiFormSection>

      <UiFormActions
        :submit-label="`Tạo ${newRoomCount} phòng`"
        :loading="loading"
        :can-submit="!loadingRooms && newRoomCount > 0"
        @cancel="navigateTo(building ? buildingPath(building) : '/dashboard/buildings')"
      />
    </form>
  </div>
</template>
