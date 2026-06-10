<script setup lang="ts">
import type { TenantFormData } from '~/components/tenants/TenantForm.vue'

definePageMeta({ title: 'Thêm khách thuê mới' })

const { isLoading, errors, apiError, submitCreate } = useTenantForm()

const formData = ref<TenantFormData>({
  full_name: '',
  phone: '',
  email: '',
  id_number: '',
  date_of_birth: '',
  permanent_address: '',
  notes: '',
  gender: '',
  occupation: '',
  id_issued_date: '',
  id_issued_place: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
})

async function onSubmit(data: TenantFormData) {
  await submitCreate({
    full_name: data.full_name,
    phone: data.phone,
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
    <div class="mb-6">
      <NuxtLink to="/tenants" class="text-sm text-muted hover:text-white transition-colors">
        ← Danh sách khách thuê
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Thêm khách thuê mới</h1>
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
        @cancel="navigateTo('/tenants')"
      />
    </div>
  </div>
</template>
