<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Building } from '~/types/buildings'
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import { buildingContractProfileSchema, type BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'
import { formatPaymentWindow } from '~/utils/format/payment-window'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  profile: BuildingContractProfile | null
  building: Building
  canEdit: boolean
  saving: boolean
  error: string | null
  editPath: string
}>()
const emit = defineEmits<{
  save: [input: BuildingContractProfileInput]
  dirty: [value: boolean]
}>()

function toForm(p: BuildingContractProfile | null) {
  return {
    lessor_full_name: p?.lessorFullName ?? '',
    lessor_date_of_birth: p?.lessorDateOfBirth ?? '',
    lessor_permanent_address: p?.lessorPermanentAddress ?? '',
    lessor_id_number: p?.lessorIdentityMasked ? '' : (p?.lessorIdNumber ?? ''),
    lessor_id_issued_date: p?.lessorIdIssuedDate ?? '',
    lessor_id_issued_place: p?.lessorIdIssuedPlace ?? '',
    lessor_phone: p?.lessorPhone ?? '',
    brand_name: p?.brandName ?? '',
    default_term_months: p?.defaultTermMonths ?? null,
    default_deposit_months: p?.defaultDepositMonths ?? null,
    notice_days: p?.noticeDays ?? null,
    deposit_refund_days: p?.depositRefundDays ?? null,
    renewal_months: p?.renewalMonths ?? null,
    extra_occupant_fee: p?.extraOccupantFee ?? null,
    drilling_fee: p?.drillingFee ?? null,
    fingerprint_reset_fee: p?.fingerprintResetFee ?? null,
    signed_copies: p?.signedCopies ?? 2,
    copies_per_party: p?.copiesPerParty ?? 1,
  }
}
const form = reactive(toForm(props.profile))
const fieldErrors = ref<Record<string, string>>({})
const baseline = ref(JSON.stringify(toForm(props.profile)))
const dirty = computed(() => props.canEdit && JSON.stringify(form) !== baseline.value)
watch(dirty, value => emit('dirty', value), { immediate: true })
watch(() => props.profile, value => {
  const next = toForm(value)
  if (JSON.stringify(next) === baseline.value) return
  baseline.value = JSON.stringify(next)
  Object.assign(form, next)
  fieldErrors.value = {}
})
watch(() => props.saving, (saving, wasSaving) => {
  if (wasSaving && !saving && !props.error) baseline.value = JSON.stringify(form)
})
const paymentWindow = computed(() => formatPaymentWindow(props.building))
type Field = {
  key: keyof typeof form
  label: string
  kind: 'text' | 'date' | 'integer' | 'decimal' | 'currency'
  placeholder?: string
  hint?: string
}
const groups: { title: string, description: string, fields: Field[] }[] = [
  {
    title: 'Bên cho thuê',
    description: 'Thông tin này in trên hợp đồng, khác với thông tin liên hệ chủ nhà.',
    fields: [
      { key: 'lessor_full_name', label: 'Họ tên bên cho thuê', kind: 'text' },
      { key: 'lessor_date_of_birth', label: 'Ngày sinh', kind: 'date' },
      { key: 'lessor_permanent_address', label: 'Địa chỉ thường trú', kind: 'text' },
      { key: 'lessor_id_number', label: 'Số CMND/CCCD', kind: 'text' },
      { key: 'lessor_id_issued_date', label: 'Ngày cấp', kind: 'date' },
      { key: 'lessor_id_issued_place', label: 'Nơi cấp', kind: 'text' },
      { key: 'lessor_phone', label: 'Số điện thoại', kind: 'text' },
    ],
  },
  {
    title: 'Mặc định hợp đồng',
    description: 'Lưu thời hạn và tiền cọc để chuẩn bị hợp đồng.',
    fields: [
      { key: 'brand_name', label: 'Tên thương hiệu', kind: 'text' },
      { key: 'default_term_months', label: 'Thời hạn (tháng)', kind: 'integer', placeholder: '12' },
      { key: 'default_deposit_months', label: 'Tiền cọc (tháng)', kind: 'decimal', placeholder: '1' },
    ],
  },
  {
    title: 'Điều khoản và phụ phí',
    description: 'Các giá trị chưa nhập được giữ trống. Nhập 0 khi không áp dụng.',
    fields: [
      { key: 'notice_days', label: 'Báo trước (ngày)', kind: 'integer', placeholder: '30', hint: 'Điều 2.5, 4.2, 4.3, 7.6, 8.2' },
      { key: 'deposit_refund_days', label: 'Hoàn cọc (ngày)', kind: 'integer', placeholder: '7', hint: 'Điều 4.5' },
      { key: 'renewal_months', label: 'Gia hạn (tháng)', kind: 'integer', placeholder: '6', hint: 'Điều 8.2 (0 = không tự gia hạn)' },
      { key: 'extra_occupant_fee', label: 'Phí thêm người (đồng)', kind: 'currency', hint: 'Điều 3.1' },
      { key: 'drilling_fee', label: 'Phí khoan tường (đồng)', kind: 'currency', hint: 'Điều 3.2' },
      { key: 'fingerprint_reset_fee', label: 'Phí đặt lại vân tay (đồng)', kind: 'currency', hint: 'Điều 3.3' },
    ],
  },
  {
    title: 'Bản ký',
    description: 'Số bản ký và số bản mỗi bên giữ.',
    fields: [
      { key: 'signed_copies', label: 'Tổng số bản ký', kind: 'integer' },
      { key: 'copies_per_party', label: 'Số bản mỗi bên giữ', kind: 'integer' },
    ],
  },
]
function updateField(field: Field, value: string) {
  const numeric = !['text', 'date'].includes(field.kind)
  Object.assign(form, { [field.key]: numeric ? (value === '' ? null : Number(value)) : value })
}
function displayValue(field: Field) {
  if (field.key === 'lessor_date_of_birth' || field.key === 'lessor_permanent_address') return 'Ẩn với vai trò quản lý'
  if (field.key === 'lessor_id_number') {
    const id = props.profile?.lessorIdNumber
    return id ? `*******${id.slice(-4)}` : 'Chưa nhập'
  }
  const value = form[field.key]
  if (value === null || value === '') return 'Chưa nhập'
  return field.kind === 'currency' ? formatCurrency(Number(value)) : value
}
function submit() {
  if (!props.canEdit || props.saving) return
  fieldErrors.value = {}
  const result = buildingContractProfileSchema.safeParse({ ...form })
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[String(issue.path[0])] = issue.message
    return
  }
  emit('save', result.data)
}
</script>

<template>
  <component :is="canEdit ? 'form' : 'div'" class="min-w-0 space-y-5" novalidate :aria-busy="saving" @submit.prevent="submit">
    <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    <p v-if="!canEdit" class="text-xs leading-relaxed text-ui-muted">
      Bạn đang xem thông tin hợp đồng. Chỉ chủ nhà và quản trị viên có thể cập nhật.
    </p>
    <section v-for="(group, index) in groups" :key="group.title" :class="index ? 'border-t border-ui-border pt-5' : ''">
      <h3 class="text-sm font-semibold text-ui-primary">{{ group.title }}</h3>
      <p class="mt-1 text-xs leading-relaxed text-ui-muted">{{ group.description }}</p>
      <div v-if="canEdit" class="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <template v-for="field in group.fields" :key="field.key">
          <UiDatePicker
            v-if="field.kind === 'date'"
            :model-value="String(form[field.key] ?? '')"
            :label="field.label"
            date-mode="past"
            :error="fieldErrors[field.key]"
            :disabled="saving"
            @update:model-value="updateField(field, $event)"
          />
          <UiInput
            v-else
            :model-value="form[field.key]"
            :data-test="field.key.replaceAll('_', '-')"
            :label="field.label"
            :type="field.kind === 'text' ? 'text' : 'number'"
            :inputmode="field.key === 'lessor_id_number' ? 'numeric' : field.key === 'lessor_phone' ? 'tel' : undefined"
            :number-mode="field.kind === 'text' ? undefined : field.kind"
            :step="field.kind === 'decimal' ? 0.1 : undefined"
            :placeholder="field.placeholder"
            :hint="field.hint"
            :error="fieldErrors[field.key]"
            :disabled="saving"
            @update:model-value="updateField(field, $event)"
          />
        </template>
      </div>
      <UiDefinitionList v-else class="mt-2">
        <UiDefinitionItem v-for="field in group.fields" :key="field.key" :label="field.label" :value="displayValue(field)" :stacked="field.key === 'lessor_permanent_address'" />
      </UiDefinitionList>
    </section>
    <section class="space-y-3 border-t border-ui-border pt-5">
      <h3 class="text-sm font-semibold text-ui-primary">Lịch thanh toán</h3>
      <template v-if="paymentWindow">
        <p class="text-sm leading-relaxed text-ui-primary">Trên hợp đồng: {{ paymentWindow.sentence }}</p>
        <ul class="grid gap-1 text-xs text-ui-muted sm:grid-cols-3">
          <li>Ngày phát hành hóa đơn: {{ paymentWindow.startDay }}</li>
          <li>Hạn thanh toán: {{ paymentWindow.endDay }}</li>
          <li>Số ngày ân hạn: {{ paymentWindow.graceDays }}</li>
        </ul>
      </template>
      <UiAlert v-else severity="warning">Chưa đủ lịch thanh toán. Cài đặt ngày phát hành hóa đơn và hạn thanh toán trước.</UiAlert>
      <NuxtLink :to="editPath" class="inline-flex rounded text-sm text-ui-accent underline underline-offset-4 hover:text-ui-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent">Sửa lịch vận hành</NuxtLink>
    </section>
    <div v-if="canEdit" class="flex justify-end border-t border-ui-border pt-4">
      <UiButton data-test="contract-profile-save" type="submit" class="w-full whitespace-nowrap sm:w-auto" :loading="saving" :disabled="saving">Lưu thông tin hợp đồng</UiButton>
    </div>
  </component>
</template>
