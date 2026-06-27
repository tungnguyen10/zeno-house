<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import type { ApiSuccess } from '~/types/api'
import type { Tenant } from '~/types/tenants'
import { tenantFormToApiPayload, type TenantFormData } from '~/components/tenants/TenantForm.vue'
import { tenantPath } from '~/utils/routes/operational'
import { isUuid } from '~/utils/format/slug'

definePageMeta({ title: 'Chỉnh sửa khách thuê' })

const route = useRoute()
const id = route.params.code as string

const { data, error } = await useFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`)

if (error.value?.statusCode === 404) {
  await navigateTo('/tenants')
}

const tenant = computed(() => data.value?.data ?? null)

// Redirect UUID-based URL to canonical code-based URL
if (tenant.value && isUuid(id) && tenant.value.code) {
  await navigateTo(`${tenantPath(tenant.value)}/edit`, { replace: true })
}

const initialFormData: TenantFormData = {
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
}

const formData = ref<TenantFormData>({ ...initialFormData })
const initialSnapshot = ref<TenantFormData>({ ...initialFormData })

const {
  isLoading,
  errors,
  apiError,
  submitUpdate,
  hasDraft,
  restoreDraft,
  clearDraft,
  isDirty,
} = useTenantForm<TenantFormData>({
  draftKey: tenant.value ? { mode: 'edit', id: tenant.value.id } : null,
  formData,
  initialSnapshot,
})

async function onSubmit(data: TenantFormData) {
  await submitUpdate(id, tenantFormToApiPayload(data))
}

onBeforeRouteLeave((_to, _from, next) => {
  if (!isDirty.value) return next()
  const ok = typeof window !== 'undefined'
    ? window.confirm('Có thay đổi chưa lưu. Bạn có chắc muốn rời trang?')
    : true
  return next(ok)
})

if (import.meta.client) {
  const handler = (event: BeforeUnloadEvent) => {
    if (!isDirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', handler)
  onBeforeUnmount(() => window.removeEventListener('beforeunload', handler))
}
</script>

<template>
  <div>
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
        :has-draft="hasDraft"
        :is-dirty="isDirty"
        @submit="onSubmit"
        @cancel="navigateTo(`/tenants/${id}`)"
        @restore-draft="restoreDraft"
        @discard-draft="clearDraft"
      />
    </div>
  </div>
</template>
