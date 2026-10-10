<script setup lang="ts">

import type { ApiSuccess } from '~/types/api'
import type { Tenant, TenantIdImageSide } from '~/types/tenants'
import { tenantFormToApiPayload, type TenantFormData } from '~/components/tenants/TenantForm.vue'
import { tenantPath } from '~/utils/routes/operational'
import { isUuid } from '~/utils/format/slug'

definePageMeta({ title: 'Chỉnh sửa khách thuê' })

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()
const id = route.params.code as string

const { data, error, status } = useLazyFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`)

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/dashboard/tenants')
})

const tenant = computed(() => data.value?.data ?? null)

// Redirect UUID-based URL to canonical code-based URL
watch(tenant, (value) => {
  if (value && isUuid(id) && value.code) navigateTo(`${tenantPath(value)}/edit`, { replace: true })
})

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
watch(tenant, (value) => {
  if (!value) return
  const next: TenantFormData = {
    full_name: value.fullName ?? '',
    phone: value.phone ?? '',
    email: value.email ?? '',
    id_number: value.idNumber ?? '',
    date_of_birth: value.dateOfBirth ?? '',
    permanent_address: value.permanentAddress ?? '',
    notes: value.notes ?? '',
    gender: value.gender ?? '',
    occupation: value.occupation ?? '',
    id_issued_date: value.idIssuedDate ?? '',
    id_issued_place: value.idIssuedPlace ?? '',
    emergency_contact_name: value.emergencyContactName ?? '',
    emergency_contact_phone: value.emergencyContactPhone ?? '',
  }
  formData.value = next
  initialSnapshot.value = { ...next }
}, { immediate: true })

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
  draftKey: { mode: 'edit', id },
  formData,
  initialSnapshot,
})

const idImageFiles = ref<Record<TenantIdImageSide, File | null>>({
  front: null,
  back: null,
})
const idImageRemoved = ref<Record<TenantIdImageSide, boolean>>({
  front: false,
  back: false,
})
const idImageLoadingSide = ref<TenantIdImageSide | null>(null)

const idCardFrontSignedUrl = computed(() => {
  if (idImageRemoved.value.front || idImageFiles.value.front) return null
  return tenant.value?.idCardFrontSignedUrl ?? null
})

const idCardBackSignedUrl = computed(() => {
  if (idImageRemoved.value.back || idImageFiles.value.back) return null
  return tenant.value?.idCardBackSignedUrl ?? null
})

function onSelectIdImage(payload: { side: TenantIdImageSide, file: File | null }) {
  idImageFiles.value = {
    ...idImageFiles.value,
    [payload.side]: payload.file,
  }
  if (payload.file) {
    idImageRemoved.value = {
      ...idImageRemoved.value,
      [payload.side]: false,
    }
  }
}

function onRemoveIdImage(side: TenantIdImageSide) {
  const hasExistingImage = side === 'front'
    ? Boolean(tenant.value?.idCardFrontPath)
    : Boolean(tenant.value?.idCardBackPath)

  idImageFiles.value = {
    ...idImageFiles.value,
    [side]: null,
  }

  idImageRemoved.value = {
    ...idImageRemoved.value,
    [side]: hasExistingImage,
  }
}

async function uploadIdImage(tenantId: string, side: TenantIdImageSide, file: File): Promise<Tenant> {
  const form = new FormData()
  form.append('image', file)
  const response = await apiFetch<ApiSuccess<Tenant>>(`/api/tenants/${tenantId}/id-image`, {
    method: 'POST',
    query: { side },
    body: form,
  })
  return response.data
}

async function removeIdImage(tenantId: string, side: TenantIdImageSide): Promise<Tenant> {
  const response = await apiFetch<ApiSuccess<Tenant>>(`/api/tenants/${tenantId}/id-image`, {
    method: 'DELETE',
    query: { side },
  })
  return response.data
}

async function onSubmit(data: TenantFormData) {
  const updated = await submitUpdate(id, tenantFormToApiPayload(data), { skipRedirect: true })
  if (!updated) return

  let latestTenant = updated

  for (const side of ['front', 'back'] as const) {
    try {
      idImageLoadingSide.value = side
      if (idImageFiles.value[side]) {
        latestTenant = await uploadIdImage(updated.id, side, idImageFiles.value[side]!)
      }
      else if (idImageRemoved.value[side]) {
        latestTenant = await removeIdImage(updated.id, side)
      }
    }
    catch {
      toast.error(`Không cập nhật được ảnh CCCD mặt ${side === 'front' ? 'trước' : 'sau'}.`)
    }
    finally {
      idImageLoadingSide.value = null
    }
  }

  await navigateTo(tenantPath(latestTenant))
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Chỉnh sửa khách thuê"
      :back-to="`/dashboard/tenants/${id}`"
      :back-label="tenant?.fullName ?? 'Khách thuê'"
    />

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

    <div v-if="status === 'idle' || status === 'pending'" class="space-y-3" aria-busy="true" aria-label="Đang tải thông tin khách thuê">
      <UiSkeleton class="h-8 w-48" />
      <UiSkeleton class="h-64 w-full rounded-xl" />
    </div>
    <UiAlert v-else-if="error" severity="danger">Không thể tải thông tin khách thuê.</UiAlert>
    <TenantForm
      v-else-if="tenant"
      v-model="formData"
      :loading="isLoading"
      :errors="errors"
      :has-draft="hasDraft"
      :is-dirty="isDirty"
      :id-card-front-signed-url="idCardFrontSignedUrl"
      :id-card-back-signed-url="idCardBackSignedUrl"
      :id-card-front-file-name="idImageFiles.front?.name ?? null"
      :id-card-back-file-name="idImageFiles.back?.name ?? null"
      :id-image-loading-side="idImageLoadingSide"
      :can-manage-id-images="authStore.can('tenants.update')"
      @submit="onSubmit"
      @select-id-image="onSelectIdImage"
      @remove-id-image="onRemoveIdImage"
      @cancel="navigateTo(`/dashboard/tenants/${id}`)"
      @restore-draft="restoreDraft"
      @discard-draft="clearDraft"
    />
  </div>
</template>
