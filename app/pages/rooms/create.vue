<script setup lang="ts">
import type { RoomFormData } from '~/components/rooms/RoomForm.vue'

definePageMeta({ title: 'Thêm phòng mới' })

const { isLoading, errors, apiError, submitCreate } = useRoomForm()

const formData = ref<RoomFormData>({
  building_id: '',
  room_number: '',
  floor: 1,
  status: 'available',
  monthly_rent: 0,
  area: '',
  description: '',
})

async function onSubmit(data: RoomFormData) {
  await submitCreate({
    building_id: data.building_id,
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
    <UiPageHeader title="Thêm phòng mới">
      <NuxtLink to="/rooms" class="text-sm text-muted hover:text-white transition-colors">
        ← Danh sách phòng
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
        @cancel="navigateTo('/rooms')"
      />
    </div>
  </div>
</template>
