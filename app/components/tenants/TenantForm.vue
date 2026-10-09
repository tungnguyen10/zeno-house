<script lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { tenantCreateSchema, type TenantCreateInput } from '~/utils/validators/tenants'
import type { TenantIdImageSide } from '~/types/tenants'

export interface TenantFormData {
  full_name: string
  phone: string
  email: string
  id_number: string
  date_of_birth: string
  permanent_address: string
  notes: string
  gender: string
  occupation: string
  id_issued_date: string
  id_issued_place: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

export function tenantFormToApiPayload(data: TenantFormData): TenantCreateInput {
  const trimOrNull = (v: string): string | null => {
    const t = v.trim()
    return t === '' ? null : t
  }
  const genderRaw = data.gender.trim()
  const gender = genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'other' ? genderRaw : null
  return {
    full_name: data.full_name.trim(),
    phone: data.phone.trim(),
    email: trimOrNull(data.email),
    id_number: trimOrNull(data.id_number),
    date_of_birth: trimOrNull(data.date_of_birth),
    permanent_address: trimOrNull(data.permanent_address),
    notes: trimOrNull(data.notes),
    gender,
    occupation: trimOrNull(data.occupation),
    id_issued_date: trimOrNull(data.id_issued_date),
    id_issued_place: trimOrNull(data.id_issued_place),
    emergency_contact_name: trimOrNull(data.emergency_contact_name),
    emergency_contact_phone: trimOrNull(data.emergency_contact_phone),
  }
}
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: TenantFormData
  errors?: Record<string, string[]>
  loading?: boolean
  submitLabel?: string
  hasDraft?: boolean
  isDirty?: boolean
  idCardFrontSignedUrl?: string | null
  idCardBackSignedUrl?: string | null
  idCardFrontFileName?: string | null
  idCardBackFileName?: string | null
  idImageLoadingSide?: TenantIdImageSide | null
  canManageIdImages?: boolean
}>(), {
  errors: () => ({}),
  loading: false,
  submitLabel: 'Lưu',
  hasDraft: false,
  isDirty: false,
  idCardFrontSignedUrl: null,
  idCardBackSignedUrl: null,
  idCardFrontFileName: null,
  idCardBackFileName: null,
  idImageLoadingSide: null,
  canManageIdImages: true,
})

const emit = defineEmits<{
  'update:modelValue': [data: TenantFormData]
  'submit': [data: TenantFormData]
  'cancel': []
  'restore-draft': []
  'discard-draft': []
  'select-id-image': [payload: { side: TenantIdImageSide, file: File | null }]
  'remove-id-image': [side: TenantIdImageSide]
}>()

const ID_ISSUED_PLACE_DEFAULT = 'Cục Cảnh Sát Quản Lý Hành Chính Về Trật Tự Xã Hội'

const genderOptions = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

const FIELD_IDS: Record<string, string> = {
  full_name: 'tf-full-name',
  phone: 'tf-phone',
  email: 'tf-email',
  date_of_birth: 'tf-date-of-birth',
  gender: 'tf-gender',
  occupation: 'tf-occupation',
  permanent_address: 'tf-permanent-address',
  id_number: 'tf-id-number',
  id_issued_date: 'tf-id-issued-date',
  id_issued_place: 'tf-id-issued-place',
  emergency_contact_name: 'tf-emergency-name',
  emergency_contact_phone: 'tf-emergency-phone',
  notes: 'tf-notes',
}

const localErrors = ref<Record<string, string>>({})
const touched = ref(new Set<string>())
const submitAttempted = ref(false)

function update<K extends keyof TenantFormData>(field: K, value: TenantFormData[K]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function markTouched(snakeField: string) {
  if (touched.value.has(snakeField)) return
  touched.value = new Set([...touched.value, snakeField])
}

function runValidation() {
  const payload = tenantFormToApiPayload(props.modelValue)
  const result = tenantCreateSchema.safeParse(payload)
  if (result.success) {
    localErrors.value = {}
    return
  }
  const next: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    if (key && !next[key]) next[key] = issue.message
  }
  localErrors.value = next
}

watch(() => props.modelValue, () => {
  if (touched.value.size > 0 || submitAttempted.value) runValidation()
}, { deep: true })

function onBlur(snakeField: string) {
  markTouched(snakeField)
  runValidation()
}

function errorFor(snakeField: string): string | undefined {
  if (!touched.value.has(snakeField) && !submitAttempted.value) return undefined
  return localErrors.value[snakeField] ?? props.errors?.[snakeField]?.[0]
}

const firstInvalidFieldId = computed<string | null>(() => {
  const merged: Record<string, string> = { ...localErrors.value }
  for (const [field, msgs] of Object.entries(props.errors ?? {})) {
    if (msgs?.length && !merged[field]) merged[field] = msgs[0]!
  }
  for (const field of Object.keys(merged)) {
    if (!touched.value.has(field) && !submitAttempted.value) continue
    const id = FIELD_IDS[field]
    if (id) return id
  }
  return null
})

function focusField(id: string) {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null
  el?.focus?.()
  el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
}

async function onSubmit() {
  submitAttempted.value = true
  runValidation()
  await nextTick()
  if (firstInvalidFieldId.value) {
    focusField(firstInvalidFieldId.value)
    return
  }
  emit('submit', props.modelValue)
}

const canSubmit = computed(() => !props.loading && (props.isDirty || props.hasDraft || submitAttempted.value))

// Local preview using VueUse — object URLs are auto-revoked on unmount
const localIdFrontFile = ref<File | undefined>()
const localIdBackFile = ref<File | undefined>()
const localIdFrontUrl = useObjectUrl(localIdFrontFile)
const localIdBackUrl = useObjectUrl(localIdBackFile)

// Clear local preview once the server-confirmed URL arrives
watch(() => props.idCardFrontSignedUrl, (url) => { if (url) localIdFrontFile.value = undefined })
watch(() => props.idCardBackSignedUrl, (url) => { if (url) localIdBackFile.value = undefined })

const idFrontPreviewUrl = computed(() => localIdFrontUrl.value ?? props.idCardFrontSignedUrl ?? null)
const idBackPreviewUrl = computed(() => localIdBackUrl.value ?? props.idCardBackSignedUrl ?? null)

function onSelectIdImage(side: TenantIdImageSide, file: File) {
  if (side === 'front') localIdFrontFile.value = file
  else localIdBackFile.value = file
  emit('select-id-image', { side, file })
}

function onRemoveIdImage(side: TenantIdImageSide) {
  if (side === 'front') localIdFrontFile.value = undefined
  else localIdBackFile.value = undefined
  emit('remove-id-image', side)
}
</script>

<template>
  <form class="space-y-6" novalidate @submit.prevent="onSubmit">
    <UiFormDraftBanner
      v-if="hasDraft"
      clear-label="Bỏ nháp"
      @restore="emit('restore-draft')"
      @clear="emit('discard-draft')"
    />

    <UiFormSection title="Thông tin cá nhân" description="Họ tên, liên hệ và thông tin nhân khẩu.">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiInput
          id="tf-full-name"
          :model-value="modelValue.full_name"
          label="Họ và tên"
          placeholder="Nguyễn Văn A"
          required
          :error="errorFor('full_name')"
          @update:model-value="(v) => update('full_name', v as string)"
          @blur="onBlur('full_name')"
        />
        <UiInput
          id="tf-phone"
          :model-value="modelValue.phone"
          type="tel"
          label="Số điện thoại"
          placeholder="0901234567"
          required
          :error="errorFor('phone')"
          @update:model-value="(v) => update('phone', v as string)"
          @blur="onBlur('phone')"
        />
        <UiInput
          id="tf-email"
          :model-value="modelValue.email"
          type="email"
          label="Email"
          placeholder="example@email.com"
          :error="errorFor('email')"
          @update:model-value="(v) => update('email', v as string)"
          @blur="onBlur('email')"
        />
        <UiDatePicker
          id="tf-date-of-birth"
          :model-value="modelValue.date_of_birth"
          date-mode="past"
          label="Ngày sinh"
          :error="errorFor('date_of_birth')"
          @update:model-value="(v) => update('date_of_birth', v as string)"
          @blur="onBlur('date_of_birth')"
        />
        <UiSelect
          id="tf-gender"
          :model-value="modelValue.gender || null"
          label="Giới tính"
          :options="genderOptions"
          placeholder="— Không chọn —"
          :error="errorFor('gender')"
          @update:model-value="(v) => update('gender', String(v ?? ''))"
        />
        <UiInput
          id="tf-occupation"
          :model-value="modelValue.occupation"
          label="Nghề nghiệp"
          placeholder="Nhân viên văn phòng, sinh viên…"
          :error="errorFor('occupation')"
          @update:model-value="(v) => update('occupation', v as string)"
          @blur="onBlur('occupation')"
        />
        <div class="sm:col-span-2">
          <UiInput
            id="tf-permanent-address"
            :model-value="modelValue.permanent_address"
            label="Địa chỉ thường trú"
            placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
            :error="errorFor('permanent_address')"
            @update:model-value="(v) => update('permanent_address', v as string)"
            @blur="onBlur('permanent_address')"
          />
        </div>
      </div>
    </UiFormSection>

    <UiFormSection title="Giấy tờ tuỳ thân" description="Thông tin CMND/CCCD để đối chiếu khi ký hợp đồng.">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiInput
          id="tf-id-number"
          :model-value="modelValue.id_number"
          label="Số CMND/CCCD"
          placeholder="012345678901"
          :error="errorFor('id_number')"
          @update:model-value="(v) => update('id_number', v as string)"
          @blur="onBlur('id_number')"
        />
        <UiDatePicker
          id="tf-id-issued-date"
          :model-value="modelValue.id_issued_date"
          date-mode="past"
          label="Ngày cấp"
          :error="errorFor('id_issued_date')"
          @update:model-value="(v) => update('id_issued_date', v as string)"
          @blur="onBlur('id_issued_date')"
        />
        <div class="sm:col-span-2">
          <UiInput
            id="tf-id-issued-place"
            :model-value="modelValue.id_issued_place"
            label="Nơi cấp"
            :placeholder="ID_ISSUED_PLACE_DEFAULT"
            :error="errorFor('id_issued_place')"
            @update:model-value="(v) => update('id_issued_place', v as string)"
            @blur="() => { onBlur('id_issued_place'); if (!modelValue.id_issued_place?.trim()) update('id_issued_place', ID_ISSUED_PLACE_DEFAULT) }"
          />
        </div>

        <div class="sm:col-span-2 rounded-lg border border-ui-border bg-ui-hover/30 p-4">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-xs font-semibold text-ui-primary">Ảnh CCCD</h4>
            <span class="text-[11px] text-ui-muted">Tối đa 5MB · JPG/PNG/WEBP</span>
          </div>

          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-2">
              <UiFileUpload
                variant="image"
                label="Mặt trước"
                accept="image/jpeg,image/png,image/webp"
                :preview-url="idFrontPreviewUrl"
                preview-alt="Ảnh CCCD mặt trước"
                pick-label="Chọn ảnh"
                replace-label="Thay ảnh"
                :disabled="loading || !canManageIdImages || idImageLoadingSide === 'front'"
                @select="(file) => onSelectIdImage('front', file)"
              />
              <UiButton
                v-if="canManageIdImages && (idCardFrontSignedUrl || localIdFrontFile)"
                type="button"
                size="sm"
                variant="ghost"
                :loading="idImageLoadingSide === 'front'"
                :disabled="loading"
                @click="onRemoveIdImage('front')"
              >
                Xóa mặt trước
              </UiButton>
            </div>

            <div class="space-y-2">
              <UiFileUpload
                variant="image"
                label="Mặt sau"
                accept="image/jpeg,image/png,image/webp"
                :preview-url="idBackPreviewUrl"
                preview-alt="Ảnh CCCD mặt sau"
                pick-label="Chọn ảnh"
                replace-label="Thay ảnh"
                :disabled="loading || !canManageIdImages || idImageLoadingSide === 'back'"
                @select="(file) => onSelectIdImage('back', file)"
              />
              <UiButton
                v-if="canManageIdImages && (idCardBackSignedUrl || localIdBackFile)"
                type="button"
                size="sm"
                variant="ghost"
                :loading="idImageLoadingSide === 'back'"
                :disabled="loading"
                @click="onRemoveIdImage('back')"
              >
                Xóa mặt sau
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </UiFormSection>

    <UiFormSection title="Liên hệ khẩn cấp" description="Người thân/đại diện liên hệ khi cần.">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiInput
          id="tf-emergency-name"
          :model-value="modelValue.emergency_contact_name"
          label="Tên người liên hệ"
          placeholder="Nguyễn Thị B"
          :error="errorFor('emergency_contact_name')"
          @update:model-value="(v) => update('emergency_contact_name', v as string)"
          @blur="onBlur('emergency_contact_name')"
        />
        <UiInput
          id="tf-emergency-phone"
          :model-value="modelValue.emergency_contact_phone"
          type="tel"
          label="SĐT người liên hệ"
          placeholder="0901234567"
          :error="errorFor('emergency_contact_phone')"
          @update:model-value="(v) => update('emergency_contact_phone', v as string)"
          @blur="onBlur('emergency_contact_phone')"
        />
      </div>
    </UiFormSection>

    <UiFormSection title="Ghi chú" description="Thông tin nội bộ về khách thuê.">
      <UiTextarea
        id="tf-notes"
        :model-value="modelValue.notes"
        label="Ghi chú"
        :rows="3"
        resize="none"
        placeholder="Thông tin thêm về khách thuê…"
        :error="errorFor('notes')"
        @update:model-value="(v) => update('notes', v as string)"
        @blur="onBlur('notes')"
      />
    </UiFormSection>

    <UiFormActions
      :submit-label="submitLabel"
      :loading="loading"
      :can-submit="canSubmit"
      @cancel="emit('cancel')"
    />
  </form>
</template>
