<script setup lang="ts">

import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import { roomPath } from '~/utils/routes/operational'

const route = useRoute()
const buildingIdentifier = route.params.id as string
const roomSlug = route.params.room as string

const { data, error } = await useFetch<ApiSuccess<Room>>(
  `/api/buildings/${buildingIdentifier}/rooms/${roomSlug}`,
)

watchEffect(() => {
  if (data.value?.data) {
    navigateTo(roomPath(data.value.data), { replace: true })
  }
  else if (error.value) {
    navigateTo('/dashboard/rooms', { replace: true })
  }
})
</script>

<template>
  <div class="space-y-3">
    <UiSkeleton class="h-8 w-64 rounded" />
    <UiSkeleton class="h-48 rounded-xl" />
  </div>
</template>
