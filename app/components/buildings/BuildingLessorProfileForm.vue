<script setup lang="ts">
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import { buildingContractProfileBaseSchema, type BuildingContractProfilePatch } from '~/utils/validators/building-contract-profile'
import type { SuggestionField, SuggestionValues } from '~/utils/tenant-identity-suggestions'

const props = withDefaults(defineProps<{
  profile: BuildingContractProfile | null
  canEdit: boolean
  saving: boolean
  error: string | null
  submitLabel?: string
}>(), { submitLabel: 'Lưu' })
const emit = defineEmits<{ save: [patch: BuildingContractProfilePatch] }>()

const LESSOR_KEYS = [
  'lessor_full_name', 'lessor_date_of_birth', 'lessor_id_number', 'lessor_id_issued_date',
  'lessor_id_issued_place', 'lessor_phone', 'lessor_email', 'lessor_permanent_address',
] as const
const lessorSchema = buildingContractProfileBaseSchema.pick(
  Object.fromEntries(LESSOR_KEYS.map(key => [key, true])) as Record<typeof LESSOR_KEYS[number], true>,
)

const toForm = (p: BuildingContractProfile | null) => ({
  lessor_full_name: p?.lessorFullName ?? '',
  lessor_date_of_birth: p?.lessorDateOfBirth ?? '',
  lessor_id_number: p?.lessorIdentityMasked ? '' : (p?.lessorIdNumber ?? ''),
  lessor_id_issued_date: p?.lessorIdIssuedDate ?? '',
  lessor_id_issued_place: p?.lessorIdIssuedPlace ?? '',
  lessor_phone: p?.lessorPhone ?? '',
  lessor_email: p?.lessorEmail ?? '',
  lessor_permanent_address: p?.lessorPermanentAddress ?? '',
})
const form = reactive(toForm(props.profile))
watch(() => props.profile, value => Object.assign(form, toForm(value)))
const fieldErrors = ref<Record<string, string>>({})

// Gender is not part of the lessor profile, so it is not offered as a suggestion.
const SCANNER_FIELD_TO_FORM = {
  full_name: 'lessor_full_name',
  date_of_birth: 'lessor_date_of_birth',
  id_number: 'lessor_id_number',
  id_issued_date: 'lessor_id_issued_date',
  id_issued_place: 'lessor_id_issued_place',
  permanent_address: 'lessor_permanent_address',
} as const satisfies Partial<Record<SuggestionField, keyof typeof form>>
const SCANNER_FIELDS = Object.keys(SCANNER_FIELD_TO_FORM) as (keyof typeof SCANNER_FIELD_TO_FORM)[]

const scannerValues = computed<SuggestionValues>(() =>
  Object.fromEntries(SCANNER_FIELDS.map(field => [field, form[SCANNER_FIELD_TO_FORM[field]]])),
)

function onScannerApply(values: SuggestionValues) {
  for (const field of SCANNER_FIELDS) {
    const value = values[field]
    if (value !== undefined) form[SCANNER_FIELD_TO_FORM[field]] = value
  }
}

const HIDDEN = 'Ẩn với vai trò quản lý'

function submit() {
  fieldErrors.value = {}
  const result = lessorSchema.safeParse({ ...form })
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[String(issue.path[0])] = issue.message
    return
  }
  emit('save', result.data)
}
</script>

<template>
  <div class="space-y-5">
    <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    <template v-if="!canEdit">
      <UiAlert severity="info">Chỉ chủ nhà và admin có thể cập nhật. Số CMND/CCCD được che.</UiAlert>
      <UiDefinitionList>
        <UiDefinitionItem label="Họ tên">{{ profile?.lessorFullName ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Số điện thoại">{{ profile?.lessorPhone ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Email">{{ profile?.lessorEmail ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Ngày sinh">{{ profile?.lessorIdentityMasked ? HIDDEN : (profile?.lessorDateOfBirth ?? '—') }}</UiDefinitionItem>
        <UiDefinitionItem label="Số CMND/CCCD">{{ profile?.lessorIdNumber ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Địa chỉ thường trú">{{ profile?.lessorIdentityMasked ? HIDDEN : (profile?.lessorPermanentAddress ?? '—') }}</UiDefinitionItem>
      </UiDefinitionList>
    </template>
    <template v-else>
      <UiFormSection title="Danh tính" description="Người ký hợp đồng. Thông tin này in trên hợp đồng.">
        <div class="grid gap-3 sm:grid-cols-2">
          <TenantIdentityScanner
            class="sm:col-span-2"
            :current-values="scannerValues"
            :fields="SCANNER_FIELDS"
            @apply="onScannerApply"
          />
          <div data-test="lessor-full-name">
            <UiInput v-model="form.lessor_full_name" label="Họ tên" :error="fieldErrors.lessor_full_name" />
          </div>
          <UiInput v-model="form.lessor_date_of_birth" label="Ngày sinh" type="date" :error="fieldErrors.lessor_date_of_birth" />
          <UiInput v-model="form.lessor_id_number" label="Số CMND/CCCD" :error="fieldErrors.lessor_id_number" />
          <UiInput v-model="form.lessor_id_issued_date" label="Ngày cấp" type="date" :error="fieldErrors.lessor_id_issued_date" />
          <div class="sm:col-span-2">
            <UiInput v-model="form.lessor_id_issued_place" label="Nơi cấp" :error="fieldErrors.lessor_id_issued_place" />
          </div>
        </div>
      </UiFormSection>
      <UiFormSection title="Liên hệ">
        <div class="grid gap-3 sm:grid-cols-2">
          <UiInput v-model="form.lessor_phone" label="Số điện thoại" type="tel" :error="fieldErrors.lessor_phone" />
          <UiInput v-model="form.lessor_email" label="Email (tùy chọn)" type="email" :error="fieldErrors.lessor_email" />
          <div class="sm:col-span-2">
            <UiInput v-model="form.lessor_permanent_address" label="Địa chỉ thường trú" :error="fieldErrors.lessor_permanent_address" />
          </div>
        </div>
      </UiFormSection>
      <div class="flex justify-end border-t border-ui-border pt-4">
        <UiButton data-test="lessor-profile-save" :loading="saving" :disabled="saving" @click="submit">{{ submitLabel }}</UiButton>
      </div>
    </template>
  </div>
</template>
