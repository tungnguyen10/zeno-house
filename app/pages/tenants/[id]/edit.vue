<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Tenant } from '~/types/tenants'
import type { TenantFormData } from '~/components/tenants/TenantForm.vue'

definePageMeta({ title: 'Chỉnh sửa khách thuê' })

const route = useRoute()
const id = route.params.id as string

const { data, error } = await useFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`)

if (error.value?.statusCode === 404) {
  await navigateTo('/tenants')
}

const tenant = computed(() => data.value?.data ?? null)

const { isLoading, errors, apiError, submitUpdate } = useTenantForm()

const formData = ref<TenantFormData>({
  full_name: tenant.value?.fullName ?? '',
  phone: tenant.value?.phone ?? '',
  email: tenant.value?.email ?? '',
  id_number: tenant.value?.idNumber ?? '',
  date_of_birth: tenant.value?.dateOfBirth ?? '',
  permanent_address: tenant.value?.permanentAddress ?? '',
  notes: tenant.value?.notes ?? '',
})

async function onSubmit(data: TenantFormData) {
  await submitUpdate(id, {
    full_name: data.full_name || undefined,
    phone: data.phone || undefined,
    email: data.email || null,
    id_number: data.id_number || null,
    date_of_birth: data.date_of_birth || null,
    permanent_address: data.permanent_address || null,
    notes: data.notes || null,
  })
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6">
      <NuxtLink :to="`/tenants/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← {{ tenant?.fullName ?? 'Khách thuê' }}
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Chỉnh sửa khách thuê</h1>
    </div>

    <div v-if="apiError" class="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
      {{ apiError }}
    </div>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <TenantForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        @submit="onSubmit"
        @cancel="navigateTo(`/tenants/${id}`)"
      />
    </div>
  </div>
</template>
