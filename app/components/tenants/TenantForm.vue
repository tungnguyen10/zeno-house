<script lang="ts">
import { tenantCreateSchema, type TenantCreateInput } from '~/utils/validators/tenants'

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
}>(), {
  errors: () => ({}),
  loading: false,
  submitLabel: 'Lưu',
  hasDraft: false,
  isDirty: false,
})

const emit = defineEmits<{
  'update:modelValue': [data: TenantFormData]
  'submit': [data: TenantFormData]
  'cancel': []
  'restore-draft': []
  'discard-draft': []
}>()

const genderOptions = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

interface FieldMeta { id: string; label: string }

const FIELD_META: Record<string, FieldMeta> = {
  full_name: { id: 'tf-full-name', label: 'Họ và tên' },
  phone: { id: 'tf-phone', label: 'Số điện thoại' },
  email: { id: 'tf-email', label: 'Email' },
  date_of_birth: { id: 'tf-date-of-birth', label: 'Ngày sinh' },
  gender: { id: 'tf-gender', label: 'Giới tính' },
  occupation: { id: 'tf-occupation', label: 'Nghề nghiệp' },
  permanent_address: { id: 'tf-permanent-address', label: 'Địa chỉ thường trú' },
  id_number: { id: 'tf-id-number', label: 'Số CMND/CCCD' },
  id_issued_date: { id: 'tf-id-issued-date', label: 'Ngày cấp' },
  id_issued_place: { id: 'tf-id-issued-place', label: 'Nơi cấp' },
  emergency_contact_name: { id: 'tf-emergency-name', label: 'Người liên hệ khẩn cấp' },
  emergency_contact_phone: { id: 'tf-emergency-phone', label: 'SĐT liên hệ khẩn cấp' },
  notes: { id: 'tf-notes', label: 'Ghi chú' },
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

interface VisibleError extends FieldMeta { field: string; message: string }

const visibleErrors = computed<VisibleError[]>(() => {
  const merged: Record<string, string> = { ...localErrors.value }
  for (const [field, msgs] of Object.entries(props.errors ?? {})) {
    if (msgs?.length && !merged[field]) merged[field] = msgs[0]!
  }
  const list: VisibleError[] = []
  for (const [field, message] of Object.entries(merged)) {
    if (!touched.value.has(field) && !submitAttempted.value) continue
    const meta = FIELD_META[field]
    if (!meta) continue
    list.push({ field, message, ...meta })
  }
  return list
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
  if (visibleErrors.value.length > 0) {
    focusField(visibleErrors.value[0]!.id)
    return
  }
  emit('submit', props.modelValue)
}

const canSubmit = computed(() => !props.loading && (props.isDirty || props.hasDraft || submitAttempted.value))
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

    <UiAlert
      v-if="visibleErrors.length > 0"
      severity="danger"
      data-test="error-summary"
      role="alert"
    >
      <div class="flex items-start gap-2">
        <IconAlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div class="flex-1">
          <p class="text-sm font-medium">Có {{ visibleErrors.length }} lỗi cần sửa</p>
          <ul class="mt-1 space-y-0.5 text-sm">
            <li v-for="err in visibleErrors" :key="err.field">
              <button
                type="button"
                class="underline hover:text-white text-left"
                @click="focusField(err.id)"
              >
                {{ err.label }}: {{ err.message }}
              </button>
            </li>
          </ul>
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
        <UiInput
          id="tf-date-of-birth"
          :model-value="modelValue.date_of_birth"
          type="date"
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
        <UiInput
          id="tf-id-issued-date"
          :model-value="modelValue.id_issued_date"
          type="date"
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
