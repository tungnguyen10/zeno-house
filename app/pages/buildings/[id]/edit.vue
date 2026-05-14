<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import type { BuildingFormData } from '~/components/buildings/BuildingForm.vue'

const route = useRoute()
const id = route.params.id as string

const { data, error } = await useFetch<ApiSuccess<Building>>(`/api/buildings/${id}`)

if (error.value?.statusCode === 404) {
  await navigateTo('/buildings')
}

const building = computed(() => data.value?.data ?? null)

const { isLoading, errors, apiError, submitUpdate } = useBuildingForm()

const formData = ref<BuildingFormData>({
  name: building.value?.name ?? '',
  address: building.value?.address ?? '',
  description: building.value?.description ?? '',
  status: building.value?.status ?? 'active',
})

async function onSubmit(data: BuildingFormData) {
  await submitUpdate(id, {
    name: data.name,
    address: data.address,
    description: data.description || null,
    status: data.status,
  })
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6">
      <NuxtLink :to="`/buildings/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← {{ building?.name ?? 'Chi tiết tòa nhà' }}
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Chỉnh sửa tòa nhà</h1>
    </div>

    <div v-if="apiError" class="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
      {{ apiError }}
    </div>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <BuildingForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        @submit="onSubmit"
        @cancel="navigateTo(`/buildings/${id}`)"
      />
    </div>
  </div>
</template>
