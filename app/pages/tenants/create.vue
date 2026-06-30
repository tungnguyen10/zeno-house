<script setup lang="ts">
import { tenantFormToApiPayload, type TenantFormData } from '~/components/tenants/TenantForm.vue'

definePageMeta({ title: 'Thêm khách thuê mới' })

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

async function onSubmit(data: TenantFormData) {
  await submitCreate(tenantFormToApiPayload(data))
}

const { showLeaveConfirm, confirmLeave, cancelLeave } = useDirtyGuard(isDirty, isLoading)
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm khách thuê mới"
      description="Khai báo thông tin khách thuê. Bạn có thể bổ sung chi tiết sau."
      :back-to="'/tenants'"
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
        @submit="onSubmit"
        @cancel="navigateTo('/tenants')"
        @restore-draft="restoreDraft"
        @discard-draft="clearDraft"
      />
    </div>

    <UiConfirmModal
      :open="showLeaveConfirm"
      title="Rời trang?"
      message="Có thay đổi chưa lưu. Bạn có chắc muốn rời trang?"
      confirm-label="Rời trang"
      @confirm="confirmLeave"
      @cancel="cancelLeave"
    />
  </div>
</template>
