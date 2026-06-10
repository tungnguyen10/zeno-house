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
    <div class="mb-6">
      <NuxtLink to="/rooms" class="text-sm text-muted hover:text-white transition-colors">
        ← Danh sách phòng
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Thêm phòng mới</h1>
    </div>

    <div v-if="apiError" class="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
      {{ apiError }}
    </div>

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
