<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'

const route = useRoute()
const buildingIdentifier = route.params.id as string
const roomSlug = route.params.room as string

const { data, error } = await useFetch<ApiSuccess<Room>>(
  `/api/buildings/${buildingIdentifier}/rooms/${roomSlug}`,
)

watchEffect(() => {
  if (data.value?.data?.id) {
    navigateTo(`/rooms/${data.value.data.id}`, { replace: true })
  }
  else if (error.value) {
    navigateTo('/rooms', { replace: true })
  }
})
</script>

<template>
  <div class="space-y-3">
    <UiSkeleton class="h-8 w-64 rounded" />
    <UiSkeleton class="h-48 rounded-xl" />
  </div>
</template>
