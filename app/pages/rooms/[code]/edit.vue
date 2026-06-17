<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import type { RoomFormData } from '~/components/rooms/RoomForm.vue'

definePageMeta({ title: 'Chỉnh sửa phòng' })

const route = useRoute()
const id = route.params.code as string

const { data, error } = await useFetch<ApiSuccess<Room>>(`/api/rooms/${id}`)

if (error.value?.statusCode === 404) {
  await navigateTo('/rooms')
}

const room = computed(() => data.value?.data ?? null)

const { isLoading, errors, apiError, submitUpdate } = useRoomForm()

const formData = ref<RoomFormData>({
  building_id: room.value?.buildingId ?? '',
  room_number: room.value?.roomNumber ?? '',
  floor: room.value?.floor ?? 1,
  status: room.value?.status ?? 'available',
  monthly_rent: room.value?.monthlyRent ?? 0,
  area: room.value?.area != null ? String(room.value.area) : '',
  description: room.value?.description ?? '',
})

async function onSubmit(data: RoomFormData) {
  await submitUpdate(id, {
    room_number: data.room_number,
    floor: data.floor,
    status: data.status,
    monthly_rent: data.monthly_rent,
    area: data.area ? Number(data.area) : null,
    description: data.description || null,
  })
}
</script>

<template>
  <div class="">
    <UiPageHeader title="Chỉnh sửa phòng">
      <NuxtLink :to="`/rooms/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← Phòng {{ room?.roomNumber ?? '' }}
      </NuxtLink>
    </UiPageHeader>

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <RoomForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        @submit="onSubmit"
        @cancel="navigateTo(`/rooms/${id}`)"
      />
    </div>
  </div>
</template>
