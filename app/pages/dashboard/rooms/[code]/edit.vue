<script setup lang="ts">

import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import { roomFormToApiPayload, type RoomFormData } from '~/components/rooms/RoomForm.vue'
import { roomPath } from '~/utils/routes/operational'

definePageMeta({ title: 'Chỉnh sửa phòng' })

const route = useRoute()
const id = route.params.code as string

const { data, error } = await useFetch<ApiSuccess<Room>>(`/api/rooms/${id}`)

if (error.value?.statusCode === 404) {
  await navigateTo('/dashboard/rooms')
}

const room = computed(() => data.value?.data ?? null)

function emptyForm(): RoomFormData {
  return {
    building_id: '',
    room_number: '',
    floor: 1,
    status: 'available',
    monthly_rent: 0,
    area: '',
    description: '',
  }
}

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

const formData = ref<RoomFormData>(room.value ? roomToForm(room.value) : emptyForm())
const initialSnapshot = computed<RoomFormData | null>(() => room.value ? roomToForm(room.value) : null)
const draftDismissed = ref(false)

watch(() => room.value, (value) => {
  if (!value) return
  formData.value = roomToForm(value)
})

const {
  isLoading,
  errors,
  apiError,
  submitUpdate,
  hasDraft,
  draftSavedAt,
  restoreDraft,
  clearDraft,
  isDirty,
} = useRoomForm<RoomFormData>({
  draftKey: { mode: 'edit', id: room.value?.id ?? id },
  formData,
  initialSnapshot,
})

const showDraft = computed(() => hasDraft.value && !draftDismissed.value)

async function onSubmit(data: RoomFormData) {
  const payload = roomFormToApiPayload(data)
  await submitUpdate(id, {
    room_number: payload.room_number,
    floor: payload.floor,
    status: payload.status,
    monthly_rent: payload.monthly_rent,
    area: payload.area,
    description: payload.description,
  })
}

function onRestoreDraft() {
  restoreDraft()
  draftDismissed.value = true
}

function onDismissDraft() {
  draftDismissed.value = true
}

function onClearDraft() {
  clearDraft()
  draftDismissed.value = true
}

</script>

<template>
  <div>
    <UiPageHeader
      :title="room ? `Chỉnh sửa · Phòng ${room.roomNumber}` : 'Chỉnh sửa phòng'"
      description="Cập nhật vị trí, trạng thái và giá chuẩn của phòng."
      :back-to="room ? roomPath(room) : `/dashboard/rooms/${id}`"
      :back-label="room?.roomNumber ? `Phòng ${room.roomNumber}` : 'Chi tiết phòng'"
    />

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <RoomForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        :has-draft="showDraft"
        :draft-saved-at="draftSavedAt"
        :is-dirty="isDirty"
        submit-label="Cập nhật"
        @submit="onSubmit"
        @cancel="navigateTo(room ? roomPath(room) : `/dashboard/rooms/${id}`)"
        @restore-draft="onRestoreDraft"
        @dismiss-draft="onDismissDraft"
        @clear-draft="onClearDraft"
      />
    </div>
  </div>
</template>
