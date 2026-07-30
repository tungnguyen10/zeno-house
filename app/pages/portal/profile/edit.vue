<script setup lang="ts">
import type { TenantGender } from '~/types/tenant-portal'
import type { TenantProfileEditForm } from '~/utils/portal-profile'
import type { TenantIdentityImageSide } from '~/utils/validators/tenant-portal'
import {
  buildTenantProfileChanges,
  toTenantProfileEditForm,
  validateTenantProfileChanges,
} from '~/utils/portal-profile'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Chỉnh sửa hồ sơ', back: '/portal/profile' })

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
const identity = usePortalIdentityImages()

const baseline = ref<TenantProfileEditForm | null>(null)
const form = reactive<TenantProfileEditForm>({
  full_name: '',
  phone: '',
  gender: null,
  date_of_birth: '',
  occupation: '',
  permanent_address: '',
  id_number: '',
  id_issued_date: '',
  id_issued_place: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
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

const GENDER_OPTIONS: Array<{ value: TenantGender, label: string }> = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

function touchField(field: keyof TenantProfileEditForm) {
  touched[field] = true
}

function visibleError(field: keyof TenantProfileEditForm): string | undefined {
  return touched[field] || submitted.value
    ? clientFieldErrors.value[field]?.[0] ?? serverFieldErrors.value[field]?.[0]
    : undefined
}

function toggleGender(value: TenantGender) {
  form.gender = form.gender === value ? null : value
}

async function onIdentitySelect(side: TenantIdentityImageSide, file: File) {
  try {
    await identity.upload(side, file)
    toast.success('Đã cập nhật ảnh định danh.')
  }
  catch (error) {
    toast.error(getApiErrorMessage(error))
  }
}

async function onIdentityRemove(side: TenantIdentityImageSide) {
  try {
    await identity.remove(side)
    toast.success('Đã xóa ảnh định danh.')
  }
  catch (error) {
    toast.error(getApiErrorMessage(error))
  }
}

async function onSave() {
  submitted.value = true
  const input = validation.value.data
  if (!input) return

  const saved = await save(input)
  if (!saved) return

  guard.allowNextLeave()
  toast.success('Đã cập nhật hồ sơ.')
  await navigateTo('/portal/profile')
}

function cancelEdit() {
  void navigateTo('/portal/profile')
}
</script>

<template>
  <div>
    <!-- <Teleport to="#portal-header-action">
      <PortalButton
        v-if="profileStatus === 'success' && profile"
        size="md"
        :loading="saving"
        :disabled="!canSave"
        @click="onSave"
      >
        Lưu
      </PortalButton>
    </Teleport> -->

    <div class="mx-auto w-full max-w-2xl px-4 pt-5 lg:px-8 lg:pt-8">
      <div v-if="profileStatus === 'pending'" class="space-y-5 pb-8">
        <PortalSkeleton variant="card" class="h-72" />
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

      <form
        v-else
        class="space-y-5 pb-2"
        @submit.prevent="onSave"
      >
        <PortalCard class="space-y-4">
          <div>
            <h2 class="portal-type-heading text-title">
              Thông tin cá nhân
            </h2>
            <p class="mt-1 portal-type-caption text-body">
              Những thông tin cơ bản dùng trong hồ sơ thuê.
            </p>
          </div>

          <PortalInput
            v-model="form.full_name"
            label="Họ và tên"
            autocomplete="name"
            required
            :error="visibleError('full_name')"
            @blur="touchField('full_name')"
          />

          <fieldset class="space-y-1.5">
            <legend class="text-sm font-medium text-title">
              Giới tính
            </legend>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in GENDER_OPTIONS"
                :key="option.value"
                type="button"
                class="min-h-11 rounded-xl border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40 motion-reduce:transition-none"
                :class="form.gender === option.value
                  ? 'border-theme bg-smoke-blue text-theme'
                  : 'border-border-light bg-white text-body hover:bg-smoke active:bg-smoke'"
                :aria-pressed="form.gender === option.value"
                @click="toggleGender(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </fieldset>

          <PortalInput
            v-model="form.date_of_birth"
            label="Ngày sinh"
            type="date"
            :error="visibleError('date_of_birth')"
            @blur="touchField('date_of_birth')"
          />

          <PortalInput
            v-model="form.occupation"
            label="Nghề nghiệp"
            autocomplete="organization-title"
            :error="visibleError('occupation')"
            @blur="touchField('occupation')"
          />
        </PortalCard>

        <PortalCard class="space-y-4">
          <div>
            <h2 class="portal-type-heading text-title">
              Liên hệ
            </h2>
            <p class="mt-1 portal-type-caption text-body">
              Ban quản lý sử dụng thông tin này khi cần trao đổi.
            </p>
          </div>

          <PortalInput
            v-model="form.phone"
            label="Số điện thoại"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            required
            :error="visibleError('phone')"
            @blur="touchField('phone')"
          />

          <PortalInput
            v-model="form.permanent_address"
            label="Địa chỉ thường trú"
            textarea
            :rows="3"
            autocomplete="street-address"
            :error="visibleError('permanent_address')"
            @blur="touchField('permanent_address')"
          />
        </PortalCard>

        <PortalCard class="space-y-4">
          <div>
            <h2 class="portal-type-heading text-title">
              Thông tin định danh
            </h2>
            <p class="mt-1 portal-type-caption text-body">
              Cập nhật đúng theo CCCD/CMND đang sử dụng.
            </p>
          </div>

          <PortalInput
            v-model="form.id_number"
            label="Số CCCD/CMND"
            inputmode="numeric"
            autocomplete="off"
            :error="visibleError('id_number')"
            @blur="touchField('id_number')"
          />

          <PortalInput
            v-model="form.id_issued_date"
            label="Ngày cấp"
            type="date"
            :error="visibleError('id_issued_date')"
            @blur="touchField('id_issued_date')"
          />

          <PortalInput
            v-model="form.id_issued_place"
            label="Nơi cấp"
            autocomplete="off"
            :error="visibleError('id_issued_place')"
            @blur="touchField('id_issued_place')"
          />

          <div class="border-t border-border-light pt-4">
            <p class="portal-type-label text-title">
              Ảnh CCCD/CMND
            </p>
            <p class="mt-1 portal-type-caption text-body">
              Ảnh rõ đủ bốn góc, tối đa 5MB.
            </p>
            <div class="mt-3 grid w-full grid-cols-2 gap-2.5 sm:gap-3">
              <PortalIdentityImageSlot
                label="Mặt trước"
                :signed-url="identity.images.value.frontSignedUrl"
                :uploading="identity.uploading.value.front"
                :progress="identity.progress.value.front"
                @select="file => onIdentitySelect('front', file)"
                @remove="onIdentityRemove('front')"
                @error="toast.error"
              />
              <PortalIdentityImageSlot
                label="Mặt sau"
                :signed-url="identity.images.value.backSignedUrl"
                :uploading="identity.uploading.value.back"
                :progress="identity.progress.value.back"
                @select="file => onIdentitySelect('back', file)"
                @remove="onIdentityRemove('back')"
                @error="toast.error"
              />
            </div>
          </div>
        </PortalCard>

        <PortalCard class="space-y-4">
          <div>
            <h2 class="portal-type-heading text-title">
              Liên hệ khẩn cấp
            </h2>
            <p class="mt-1 portal-type-caption text-body">
              Người có thể được liên hệ khi có tình huống khẩn cấp.
            </p>
          </div>

          <PortalInput
            v-model="form.emergency_contact_name"
            label="Người liên hệ"
            autocomplete="off"
            :error="visibleError('emergency_contact_name')"
            @blur="touchField('emergency_contact_name')"
          />

          <PortalInput
            v-model="form.emergency_contact_phone"
            label="Số điện thoại khẩn cấp"
            type="tel"
            inputmode="tel"
            autocomplete="off"
            :error="visibleError('emergency_contact_phone')"
            @blur="touchField('emergency_contact_phone')"
          />
        </PortalCard>

        <PortalCard class="space-y-4">
          <div>
            <h2 class="portal-type-heading text-title">
              Ghi chú
            </h2>
            <p class="mt-1 portal-type-caption text-body">
              Thông tin bổ sung bạn muốn lưu cùng hồ sơ.
            </p>
          </div>

          <PortalInput
            v-model="form.notes"
            label="Nội dung"
            textarea
            :rows="4"
            :error="visibleError('notes')"
            @blur="touchField('notes')"
          />
        </PortalCard>

        <PortalCard>
          <div class="flex items-start gap-3">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-smoke-blue text-theme"
              aria-hidden="true"
            >
              <IconShield class="h-4 w-4" />
            </span>
            <div class="min-w-0">
              <h2 class="portal-type-label text-title">
                Email đăng nhập
              </h2>
              <p class="mt-1 portal-type-caption text-body">
                Email đăng nhập được quản lý riêng và không thay đổi cùng hồ sơ cá nhân.
              </p>
            </div>
          </div>
        </PortalCard>

        <p
          v-if="apiError"
          role="alert"
          class="rounded-xl border border-portal-danger/25 bg-portal-danger/5 px-4 py-3 portal-type-body text-portal-danger"
        >
          {{ apiError }}
        </p>

        <div
          class="portal-safe-bottom sticky bottom-0 z-20 -mx-4 border-t border-border-light bg-[color:var(--portal-bg)]/95 px-4 py-3 backdrop-blur-sm"
        >
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
            <PortalButton
              variant="secondary"
              block
              :disabled="saving"
              @click="cancelEdit"
            >
              Hủy
            </PortalButton>
            <PortalButton
              type="submit"
              block
              :loading="saving"
              :disabled="!canSave"
            >
              Lưu thay đổi
            </PortalButton>
          </div>
        </div>
      </form>
    </div>

    <PortalBottomSheet
      :model-value="guard.discardOpen.value"
      title="Bỏ thay đổi?"
      @update:model-value="guard.onDiscardSheetUpdate"
    >
      <p class="portal-type-body text-body">
        Các thay đổi hồ sơ chưa lưu sẽ bị mất.
      </p>
      <div class="mt-5 grid gap-3 sm:grid-cols-2">
        <PortalButton
          variant="secondary"
          block
          @click="guard.keepEditing"
        >
          Tiếp tục chỉnh sửa
        </PortalButton>
        <PortalButton
          variant="danger"
          block
          @click="guard.discardChanges"
        >
          Bỏ thay đổi
        </PortalButton>
      </div>
    </PortalBottomSheet>
  </div>
</template>
