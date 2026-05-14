<script setup lang="ts">
import type { BuildingFormData } from '~/components/buildings/BuildingForm.vue'
const { isLoading, errors, apiError, submitCreate } = useBuildingForm()

const formData = ref<BuildingFormData>({
  name: '',
  address: '',
  description: '',
  status: 'active',
})

async function onSubmit(data: BuildingFormData) {
  await submitCreate({
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
      <NuxtLink to="/buildings" class="text-sm text-muted hover:text-white transition-colors">
        ← Danh sách tòa nhà
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Thêm tòa nhà mới</h1>
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
        @cancel="navigateTo('/buildings')"
      />
    </div>
  </div>
</template>
