<script lang="ts">
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

function onIdImageChange(side: TenantIdImageSide, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  emit('select-id-image', { side, file })
}

function removeIdImage(side: TenantIdImageSide) {
  emit('remove-id-image', side)
}
</script>

<template>
  <form class="space-y-8 pb-28 md:pb-0" novalidate @submit.prevent="onSubmit">
    <UiAlert v-if="hasDraft" severity="info" data-test="draft-banner">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm">
          <IconCheckCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Có bản nháp chưa lưu cho biểu mẫu này.</span>
        </div>
        <div class="flex items-center gap-2">
          <UiButton size="sm" variant="secondary" @click="emit('restore-draft')">Khôi phục</UiButton>
          <UiButton size="sm" variant="ghost" @click="emit('discard-draft')">Bỏ nháp</UiButton>
        </div>
      </div>
    </UiAlert>

    <!-- 1. Personal -->
    <section class="space-y-4">
      <header>
        <h3 class="text-sm font-semibold text-white">1. Thông tin cá nhân</h3>
        <p class="text-xs text-muted mt-0.5">Họ tên, liên hệ và thông tin nhân khẩu.</p>
      </header>
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
    </section>

    <div class="border-t border-dark-border" />

    <!-- 2. ID document -->
    <section class="space-y-4">
      <header>
        <h3 class="text-sm font-semibold text-white">2. Giấy tờ tuỳ thân</h3>
        <p class="text-xs text-muted mt-0.5">Thông tin CMND/CCCD để đối chiếu khi ký hợp đồng.</p>
      </header>
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
            placeholder="Cục CS ĐKQL cư trú và DLQG về dân cư"
            :error="errorFor('id_issued_place')"
            @update:model-value="(v) => update('id_issued_place', v as string)"
            @blur="onBlur('id_issued_place')"
          />
        </div>

        <div class="sm:col-span-2 rounded-lg border border-dark-border bg-dark-deep/20 p-4">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-xs font-semibold text-white">Ảnh CCCD</h4>
            <span class="text-[11px] text-muted">Tối đa 5MB · JPG/PNG/WEBP</span>
          </div>

          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="block text-xs font-medium text-muted" for="tf-id-front-image">Mặt trước</label>
              <input
                id="tf-id-front-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-cyan/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cyan"
                :disabled="loading || !canManageIdImages || idImageLoadingSide === 'front'"
                @change="onIdImageChange('front', $event)"
              >
              <p v-if="idCardFrontFileName" class="text-xs text-muted">{{ idCardFrontFileName }}</p>
              <p v-else-if="idCardFrontSignedUrl" class="text-xs text-muted">
                <a :href="idCardFrontSignedUrl" target="_blank" rel="noopener" class="text-cyan hover:underline">Xem ảnh mặt trước</a>
              </p>
              <UiButton
                v-if="canManageIdImages && (idCardFrontSignedUrl || idCardFrontFileName)"
                type="button"
                size="sm"
                variant="ghost"
                :loading="idImageLoadingSide === 'front'"
                :disabled="loading"
                @click="removeIdImage('front')"
              >
                Xóa mặt trước
              </UiButton>
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-medium text-muted" for="tf-id-back-image">Mặt sau</label>
              <input
                id="tf-id-back-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-cyan/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cyan"
                :disabled="loading || !canManageIdImages || idImageLoadingSide === 'back'"
                @change="onIdImageChange('back', $event)"
              >
              <p v-if="idCardBackFileName" class="text-xs text-muted">{{ idCardBackFileName }}</p>
              <p v-else-if="idCardBackSignedUrl" class="text-xs text-muted">
                <a :href="idCardBackSignedUrl" target="_blank" rel="noopener" class="text-cyan hover:underline">Xem ảnh mặt sau</a>
              </p>
              <UiButton
                v-if="canManageIdImages && (idCardBackSignedUrl || idCardBackFileName)"
                type="button"
                size="sm"
                variant="ghost"
                :loading="idImageLoadingSide === 'back'"
                :disabled="loading"
                @click="removeIdImage('back')"
              >
                Xóa mặt sau
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="border-t border-dark-border" />

    <!-- 3. Emergency contact -->
    <section class="space-y-4">
      <header>
        <h3 class="text-sm font-semibold text-white">3. Liên hệ khẩn cấp</h3>
        <p class="text-xs text-muted mt-0.5">Người thân/đại diện liên hệ khi cần.</p>
      </header>
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
    </section>

    <div class="border-t border-dark-border" />

    <!-- 4. Notes -->
    <section class="space-y-4">
      <header>
        <h3 class="text-sm font-semibold text-white">4. Ghi chú</h3>
        <p class="text-xs text-muted mt-0.5">Thông tin nội bộ về khách thuê.</p>
      </header>
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
    </section>

    <!-- Desktop footer -->
    <div class="hidden md:flex items-center justify-end gap-3 pt-2 border-t border-dark-border">
      <UiButton variant="ghost" type="button" :disabled="loading" @click="emit('cancel')">
        Huỷ
      </UiButton>
      <UiButton type="submit" :loading="loading" :disabled="!canSubmit">
        {{ submitLabel }}
      </UiButton>
    </div>

    <!-- Mobile sticky save bar -->
    <div
      data-test="sticky-save-bar"
      class="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-dark-border bg-dark-deep/95 px-4 pt-3 backdrop-blur"
      :style="{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }"
    >
      <div class="flex items-center gap-2">
        <UiButton class="flex-1" variant="ghost" type="button" :disabled="loading" @click="emit('cancel')">
          Huỷ
        </UiButton>
        <UiButton class="flex-1" type="submit" :loading="loading" :disabled="!canSubmit" @click="onSubmit">
          {{ submitLabel }}
        </UiButton>
      </div>
    </div>
  </form>
</template>
