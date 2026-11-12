<script setup lang="ts">
import type { TenantProfileEditForm } from '~/utils/portal-profile'
import {
  buildTenantProfileChanges,
  toTenantProfileEditForm,
  validateTenantProfileChanges,
} from '~/utils/portal-profile'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Sửa thông tin liên hệ', back: '/portal/profile' })

const toast = usePortalToast()
const {
  profile,
  status: profileStatus,
  error: profileError,
  refresh: refreshProfile,
  save,
  saving,
  fieldErrors: serverFieldErrors,
  apiError,
} = usePortalProfile()

const baseline = ref<TenantProfileEditForm | null>(null)
const form = reactive<TenantProfileEditForm>({
  phone: '',
  occupation: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
})
const touched = reactive<Partial<Record<keyof TenantProfileEditForm, boolean>>>({})
const submitted = ref(false)

watch(profile, (value) => {
  if (!value || baseline.value) return
  const initial = toTenantProfileEditForm(value)
  Object.assign(form, initial)
  baseline.value = initial
}, { immediate: true })

const changes = computed(() => (
  baseline.value
    ? buildTenantProfileChanges(form, baseline.value)
    : null
))
const validation = computed(() => validateTenantProfileChanges(changes.value))
const clientFieldErrors = computed(() => validation.value.fieldErrors)
const dirty = computed(() => changes.value !== null)
const canSave = computed(() => (
  dirty.value
  && !saving.value
  && validation.value.data !== null
))

const guard = usePortalUnsavedChanges(dirty)
onBeforeRouteLeave(guard.guardRouteLeave)

onMounted(() => {
  window.addEventListener('beforeunload', guard.onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', guard.onBeforeUnload)
})

function touchField(field: keyof TenantProfileEditForm) {
  touched[field] = true
}

function visibleError(field: keyof TenantProfileEditForm): string | undefined {
  return touched[field] || submitted.value
    ? clientFieldErrors.value[field]?.[0] ?? serverFieldErrors.value[field]?.[0]
    : undefined
}

async function onSave() {
  submitted.value = true
  const input = validation.value.data
  if (!input) return

  const saved = await save(input)
  if (!saved) return

  guard.allowNextLeave()
  toast.success('Đã cập nhật thông tin liên hệ.')
  await navigateTo('/portal/profile')
}

function cancelEdit() {
  void navigateTo('/portal/profile')
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 pt-5 lg:px-8 lg:pt-8">
    <div v-if="profileStatus === 'pending'" class="space-y-5 pb-8">
      <PortalSkeleton variant="card" class="h-64" />
      <PortalSkeleton variant="card" class="h-48" />
    </div>
    <PortalEmptyState
      v-else-if="profileError || !profile"
      class="mb-8"
      tone="error"
      title="Không tải được hồ sơ"
      description="Hãy kiểm tra kết nối và thử tải lại trước khi chỉnh sửa."
      action-label="Thử lại"
      @action="refreshProfile"
    />
    <form v-else class="space-y-5 pb-2" @submit.prevent="onSave">
      <p class="px-1 portal-type-body text-body">
        Bạn có thể cập nhật thông tin liên hệ tại đây. Thông tin định danh được ban quản lý đối chiếu trước khi cập nhật.
        <NuxtLink to="/portal/requests?intent=profile-correction" class="inline-flex min-h-11 items-center rounded-md text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40">
          Yêu cầu chỉnh sửa hồ sơ
        </NuxtLink>
      </p>
      <PortalCard class="space-y-4">
        <div>
          <h2 class="portal-type-heading text-title">Liên hệ và công việc</h2>
          <p class="mt-1 portal-type-caption text-body">Thông tin để ban quản lý liên lạc khi cần.</p>
        </div>
        <PortalInput
          v-model="form.phone"
          label="Số điện thoại"
          type="tel"
          autocomplete="tel"
          required
          :disabled="saving"
          :error="visibleError('phone')"
          @blur="touchField('phone')"
        />
        <PortalInput
          v-model="form.occupation"
          label="Nghề nghiệp"
          :disabled="saving"
          :error="visibleError('occupation')"
          @blur="touchField('occupation')"
        />
      </PortalCard>
      <PortalCard class="space-y-4">
        <div>
          <h2 class="portal-type-heading text-title">Liên hệ khẩn cấp</h2>
          <p class="mt-1 portal-type-caption text-body">Người có thể được liên hệ khi có tình huống khẩn cấp.</p>
        </div>
        <PortalInput
          v-model="form.emergency_contact_name"
          label="Người liên hệ"
          :disabled="saving"
          :error="visibleError('emergency_contact_name')"
          @blur="touchField('emergency_contact_name')"
        />
        <PortalInput
          v-model="form.emergency_contact_phone"
          label="Số điện thoại khẩn cấp"
          type="tel"
          :disabled="saving"
          :error="visibleError('emergency_contact_phone')"
          @blur="touchField('emergency_contact_phone')"
        />
      </PortalCard>
      <div class="portal-safe-bottom sticky bottom-0 z-20 -mx-4 border-t border-border-light bg-[color:var(--portal-bg)]/95 px-4 py-3 backdrop-blur-sm">
        <p v-if="apiError" role="alert" class="mb-3 rounded-xl border border-portal-danger/25 bg-portal-danger/5 px-4 py-3 portal-type-body text-portal-danger">
          {{ apiError }}
        </p>
        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <PortalButton variant="secondary" block :disabled="saving" @click="cancelEdit">Hủy</PortalButton>
          <PortalButton type="submit" block :loading="saving" :disabled="!canSave">Lưu thay đổi</PortalButton>
        </div>
      </div>
    </form>
    <PortalBottomSheet :model-value="guard.discardOpen.value" title="Bỏ thay đổi?" @update:model-value="guard.onDiscardSheetUpdate">
      <p class="portal-type-body text-body">Bạn có thay đổi chưa lưu. Những thay đổi này sẽ bị bỏ nếu rời trang.</p>
      <div class="mt-5 grid grid-cols-2 gap-3">
        <PortalButton variant="secondary" block @click="guard.keepEditing">Tiếp tục chỉnh sửa</PortalButton>
        <PortalButton block @click="guard.discardChanges">Bỏ thay đổi</PortalButton>
      </div>
    </PortalBottomSheet>
  </div>
</template>
