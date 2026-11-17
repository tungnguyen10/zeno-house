<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import { buildingContractProfileBaseSchema, contractProfileCopiesRule, type BuildingContractProfilePatch } from '~/utils/validators/building-contract-profile'
import { contractTermsInitialValues } from '~/utils/contracts/contract-term-suggestions'
import { formatPaymentWindow } from '~/utils/format/payment-window'

const props = withDefaults(defineProps<{
  profile: BuildingContractProfile | null
  building: Building
  canEdit: boolean
  saving: boolean
  error: string | null
  submitLabel?: string
}>(), { submitLabel: 'Lưu' })
const emit = defineEmits<{ save: [patch: BuildingContractProfilePatch] }>()

const TERMS_KEYS = [
  'brand_name', 'default_term_months', 'default_deposit_months', 'notice_days',
  'deposit_refund_days', 'renewal_months', 'extra_occupant_fee', 'drilling_fee',
  'fingerprint_reset_fee', 'signed_copies', 'copies_per_party',
] as const
const termsSchema = buildingContractProfileBaseSchema
  .pick(Object.fromEntries(TERMS_KEYS.map(key => [key, true])) as Record<typeof TERMS_KEYS[number], true>)
  .superRefine(contractProfileCopiesRule)

const form = reactive(contractTermsInitialValues(props.profile))
watch(() => props.profile, value => Object.assign(form, contractTermsInitialValues(value)))
const fieldErrors = ref<Record<string, string>>({})

const showSuggestionHint = computed(() => !props.profile?.updatedAt)

const DEPOSIT_PRESETS = [0.5, 1, 1.5, 2, 3]
const DEPOSIT_UNIT_OPTIONS = [
  { value: 'months', label: 'Tháng tiền thuê' },
  { value: 'percent', label: '% tiền thuê 1 tháng' },
]
const depositUnit = ref<'months' | 'percent'>('months')

// The stored value is always months of rent; percent is only an input/display unit.
const depositInput = computed({
  get: () => {
    const months = form.default_deposit_months
    if (months === null || months === undefined || String(months) === '') return ''
    const n = Number(months)
    return String(depositUnit.value === 'percent' ? Math.round(n * 100) : n)
  },
  set: (value: string) => {
    if (value.trim() === '') {
      form.default_deposit_months = null
      return
    }
    const n = Number(value)
    if (Number.isNaN(n)) return
    form.default_deposit_months = depositUnit.value === 'percent' ? n / 100 : n
  },
})

const depositHint = computed(() => {
  const months = Number(form.default_deposit_months)
  if (form.default_deposit_months === null || Number.isNaN(months)) return 'Mặc định 1 tháng tiền thuê'
  return depositUnit.value === 'percent'
    ? `Tương đương ${months} tháng tiền thuê`
    : `Tương đương ${Math.round(months * 100)}% tiền thuê 1 tháng`
})

function pickDepositPreset(months: number) {
  form.default_deposit_months = months
}
const paymentWindow = computed(() => formatPaymentWindow(props.building))

function submit() {
  fieldErrors.value = {}
  const result = termsSchema.safeParse({ ...form })
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
      <UiAlert severity="info">Chỉ chủ nhà và admin có thể cập nhật.</UiAlert>
      <UiDefinitionList>
        <UiDefinitionItem label="Thời hạn mặc định">{{ profile?.defaultTermMonths ? `${profile.defaultTermMonths} tháng` : '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Số tháng cọc">{{ profile?.defaultDepositMonths ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Tên thương hiệu">{{ profile?.brandName ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Số ngày báo trước">{{ profile?.noticeDays ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Số ngày hoàn cọc">{{ profile?.depositRefundDays ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Số tháng tự gia hạn">{{ profile?.renewalMonths ?? '—' }}</UiDefinitionItem>
      </UiDefinitionList>
    </template>
    <template v-else>
      <UiAlert v-if="showSuggestionHint" severity="info">Đã điền sẵn giá trị thường dùng. Xem lại rồi lưu.</UiAlert>

      <UiFormSection title="Mặc định cho hợp đồng mới">
        <div class="grid gap-3 sm:grid-cols-3">
          <UiInput v-model="form.default_term_months" label="Thời hạn (tháng)" type="number" number-mode="integer" placeholder="12" :error="fieldErrors.default_term_months" />
          <div class="space-y-2 sm:col-span-2">
            <div class="grid gap-3 sm:grid-cols-2">
              <UiInput
                v-model="depositInput"
                :label="depositUnit === 'percent' ? 'Tiền cọc (%)' : 'Số tháng cọc'"
                type="number"
                :placeholder="depositUnit === 'percent' ? '100' : '1'"
                :hint="depositHint"
                :error="fieldErrors.default_deposit_months"
              />
              <UiSelect v-model="depositUnit" label="Đơn vị" :options="DEPOSIT_UNIT_OPTIONS" />
            </div>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Chọn nhanh số tháng cọc">
              <UiButton
                v-for="preset in DEPOSIT_PRESETS"
                :key="preset"
                size="sm"
                :variant="Number(form.default_deposit_months) === preset ? 'primary' : 'secondary'"
                :aria-pressed="Number(form.default_deposit_months) === preset"
                :data-test="`deposit-preset-${preset}`"
                @click="pickDepositPreset(preset)"
              >
                {{ depositUnit === 'percent' ? `${preset * 100}%` : `${preset} tháng` }}
              </UiButton>
            </div>
          </div>
          <UiInput v-model="form.brand_name" label="Tên thương hiệu" placeholder="Mặc định dùng tên tòa" :error="fieldErrors.brand_name" />
        </div>
      </UiFormSection>

      <UiFormSection title="Điều khoản">
        <div class="grid gap-3 sm:grid-cols-2">
          <UiInput v-model="form.notice_days" label="Số ngày báo trước" type="number" number-mode="integer" placeholder="30" hint="Điều 2.5, 4.2, 4.3, 7.6, 8.2" :error="fieldErrors.notice_days" />
          <UiInput v-model="form.deposit_refund_days" label="Số ngày hoàn cọc" type="number" number-mode="integer" placeholder="7" hint="Điều 4.5" :error="fieldErrors.deposit_refund_days" />
          <UiInput v-model="form.renewal_months" label="Số tháng tự gia hạn" type="number" number-mode="integer" placeholder="6" hint="Điều 8.2 (0 = không tự gia hạn)" :error="fieldErrors.renewal_months" />
          <UiInput v-model="form.extra_occupant_fee" label="Phí người ở vượt số đăng ký" type="number" number-mode="currency" hint="Điều 3.1" :error="fieldErrors.extra_occupant_fee" />
          <UiInput v-model="form.drilling_fee" label="Phí khoan tường" type="number" number-mode="currency" hint="Điều 3.2" :error="fieldErrors.drilling_fee" />
          <UiInput v-model="form.fingerprint_reset_fee" label="Phí làm lại vân tay" type="number" number-mode="currency" hint="Điều 3.3" :error="fieldErrors.fingerprint_reset_fee" />
        </div>
      </UiFormSection>

      <details class="rounded-lg border border-ui-border">
        <summary class="cursor-pointer px-4 py-2 text-sm font-medium text-ui-primary">Bản ký và lịch thanh toán</summary>
        <div class="space-y-5 border-t border-ui-border p-4">
          <UiFormSection title="Bản ký">
            <div class="grid gap-3 sm:grid-cols-2">
              <UiInput v-model="form.signed_copies" label="Số bản ký" type="number" number-mode="integer" :error="fieldErrors.signed_copies" />
              <UiInput v-model="form.copies_per_party" label="Số bản mỗi bên giữ" type="number" number-mode="integer" :error="fieldErrors.copies_per_party" />
            </div>
          </UiFormSection>
          <UiFormSection title="Lịch thanh toán trên hợp đồng (chỉ đọc)">
            <template v-if="paymentWindow">
              <p class="text-sm text-ui-primary">Trên hợp đồng: {{ paymentWindow.sentence }}</p>
              <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ui-muted">
                <span>Ngày phát hành hóa đơn: {{ paymentWindow.startDay }}</span>
                <span>Hạn thanh toán: {{ paymentWindow.endDay }}</span>
                <span>Số ngày ân hạn: {{ paymentWindow.graceDays }}</span>
              </div>
              <a href="#basics" class="mt-2 inline-block text-xs text-ui-accent hover:underline">Sửa lịch vận hành</a>
            </template>
            <template v-else>
              <UiAlert severity="warning">
                Chưa đủ lịch thanh toán. Cài đặt ngày phát hành hóa đơn và hạn thanh toán trước.
              </UiAlert>
              <a href="#basics" class="mt-2 inline-block text-xs text-ui-accent hover:underline">Sửa lịch vận hành</a>
            </template>
          </UiFormSection>
        </div>
      </details>

      <div class="flex justify-end border-t border-ui-border pt-4">
        <UiButton data-test="contract-terms-save" :loading="saving" :disabled="saving" @click="submit">{{ submitLabel }}</UiButton>
      </div>
    </template>
  </div>
</template>
