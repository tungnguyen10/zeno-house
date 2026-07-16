<script setup lang="ts">

import { tenantFormToApiPayload, type TenantFormData } from '~/components/tenants/TenantForm.vue'
import type { TenantIdImageSide } from '~/types/tenants'
import { tenantPath } from '~/utils/routes/operational'

definePageMeta({ title: 'Thêm khách thuê mới' })

const authStore = useAuthStore()
const toast = useToast()

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

const initialSnapshot = ref<TenantFormData>({ ...formData.value })

const {
  isLoading,
  errors,
  apiError,
  submitCreate,
  hasDraft,
  restoreDraft,
  clearDraft,
  isDirty,
} = useTenantForm<TenantFormData>({
  draftKey: { mode: 'create' },
  formData,
  initialSnapshot,
})

const idImageFiles = ref<Record<TenantIdImageSide, File | null>>({
  front: null,
  back: null,
})
const idImageLoadingSide = ref<TenantIdImageSide | null>(null)

function onSelectIdImage(payload: { side: TenantIdImageSide, file: File | null }) {
  idImageFiles.value = {
    ...idImageFiles.value,
    [payload.side]: payload.file,
  }
}

function onRemoveIdImage(side: TenantIdImageSide) {
  idImageFiles.value = {
    ...idImageFiles.value,
    [side]: null,
  }
}

async function uploadIdImage(tenantId: string, side: TenantIdImageSide, file: File) {
  const form = new FormData()
  form.append('image', file)
  await apiFetch(`/api/tenants/${tenantId}/id-image`, {
    method: 'POST',
    query: { side },
    body: form,
  })
}

async function onSubmit(data: TenantFormData) {
  const created = await submitCreate(tenantFormToApiPayload(data), { skipRedirect: true })
  if (!created) return

  for (const side of ['front', 'back'] as const) {
    const file = idImageFiles.value[side]
    if (!file) continue
    try {
      idImageLoadingSide.value = side
      await uploadIdImage(created.id, side, file)
    }
    catch {
      toast.error(`Không tải được ảnh CCCD mặt ${side === 'front' ? 'trước' : 'sau'}.`)
    }
    finally {
      idImageLoadingSide.value = null
    }
  }

  await navigateTo(tenantPath(created))
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm khách thuê mới"
      description="Khai báo thông tin khách thuê. Bạn có thể bổ sung chi tiết sau."
      :back-to="'/dashboard/tenants'"
      back-label="Danh sách khách thuê"
    />

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
        :id-card-front-file-name="idImageFiles.front?.name ?? null"
        :id-card-back-file-name="idImageFiles.back?.name ?? null"
        :id-image-loading-side="idImageLoadingSide"
        :can-manage-id-images="authStore.can('tenants.update')"
        @submit="onSubmit"
        @select-id-image="onSelectIdImage"
        @remove-id-image="onRemoveIdImage"
        @cancel="navigateTo('/dashboard/tenants')"
        @restore-draft="restoreDraft"
        @discard-draft="clearDraft"
      />
    </div>
  </div>
</template>
