<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Tenant } from '~/types/tenants'
import type { TenantFormData } from '~/components/tenants/TenantForm.vue'

definePageMeta({ title: 'Chỉnh sửa khách thuê' })

const route = useRoute()
const id = route.params.code as string

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
  gender: tenant.value?.gender ?? '',
  occupation: tenant.value?.occupation ?? '',
  id_issued_date: tenant.value?.idIssuedDate ?? '',
  id_issued_place: tenant.value?.idIssuedPlace ?? '',
  emergency_contact_name: tenant.value?.emergencyContactName ?? '',
  emergency_contact_phone: tenant.value?.emergencyContactPhone ?? '',
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
    gender: (data.gender as 'male' | 'female' | 'other' | null) || null,
    occupation: data.occupation || null,
    id_issued_date: data.id_issued_date || null,
    id_issued_place: data.id_issued_place || null,
    emergency_contact_name: data.emergency_contact_name || null,
    emergency_contact_phone: data.emergency_contact_phone || null,
  })
}
</script>

<template>
  <div class="">
    <UiPageHeader title="Chỉnh sửa khách thuê">
      <NuxtLink :to="`/tenants/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← {{ tenant?.fullName ?? 'Khách thuê' }}
      </NuxtLink>
    </UiPageHeader>

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

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
