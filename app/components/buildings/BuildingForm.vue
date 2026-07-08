<script setup lang="ts">
import type { BuildingFormData } from '~/types/building-form'
import { buildingFormToApiPayload } from '~/utils/mappers/building-form'
import { buildingCreateSchema } from '~/utils/validators/buildings'

const props = withDefaults(defineProps<{
  modelValue: BuildingFormData
  /** Server-side errors keyed by snake_case field. */
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
  'update:modelValue': [data: BuildingFormData]
  'submit': [data: BuildingFormData]
  'cancel': []
  'restore-draft': []
  'discard-draft': []
}>()

const statusOptions = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Tạm ngưng' },
]
const electricityPricingOptions = [
  { value: 'per_kwh', label: 'Theo kWh' },
  { value: 'fixed', label: 'Cố định' },
  { value: 'tiered', label: 'Bậc thang' },
]
const waterPricingOptions = [
  { value: 'per_m3', label: 'Theo m³' },
  { value: 'per_person', label: 'Theo đầu người' },
  { value: 'fixed_per_room', label: 'Cố định/phòng' },
]

const FIELD_IDS: Record<string, string> = {
  name: 'bf-name',
  address: 'bf-address',
  description: 'bf-description',
  status: 'bf-status',
  owner_name: 'bf-owner-name',
  owner_phone: 'bf-owner-phone',
  owner_email: 'bf-owner-email',
  electricity_pricing_type: 'bf-electricity-pricing',
  default_electricity_rate: 'bf-electricity-rate',
  water_pricing_type: 'bf-water-pricing',
  default_water_rate: 'bf-water-rate',
  meter_reading_day: 'bf-meter-reading-day',
  billing_generation_day: 'bf-billing-day',
  payment_due_day: 'bf-due-day',
  grace_period_days: 'bf-grace-days',
  operational_start_year: 'bf-operational-start-period',
  operational_start_month: 'bf-operational-start-period',
}

const localErrors = ref<Record<string, string>>({})
const touched = ref(new Set<string>())
const submitAttempted = ref(false)

function update<K extends keyof BuildingFormData>(field: K, value: BuildingFormData[K]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function markTouched(snakeField: string) {
  if (touched.value.has(snakeField)) return
  touched.value = new Set([...touched.value, snakeField])
}

function runValidation() {
  const payload = buildingFormToApiPayload(props.modelValue)
  const result = buildingCreateSchema.safeParse(payload)
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

const operationalStartPeriod = computed({
  get: () => {
    const year = (props.modelValue.operationalStartYear ?? '').trim()
    const month = (props.modelValue.operationalStartMonth ?? '').trim()
    if (!year || !month) return ''

    const monthNum = Number(month)
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) return ''

    return `${year}-${String(monthNum).padStart(2, '0')}`
  },
  set: (value: string) => {
    if (!value) {
      emit('update:modelValue', {
        ...props.modelValue,
        operationalStartYear: '',
        operationalStartMonth: '',
      })
      return
    }

    const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
    if (!match) return

    const year = match[1]
    const month = match[2]
    if (!year || !month) return

    emit('update:modelValue', {
      ...props.modelValue,
      operationalStartYear: year,
      operationalStartMonth: String(Number(month)),
    })
  },
})

const operationalStartError = computed(() =>
  errorFor('operational_start_year') ?? errorFor('operational_start_month'),
)

function onOperationalStartBlur() {
  onBlur('operational_start_year')
  onBlur('operational_start_month')
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
</script>

<template>
  <form class="space-y-8 pb-28 md:pb-0" novalidate @submit.prevent="onSubmit">
    <UiAlert
      v-if="hasDraft"
      severity="info"
      data-test="draft-banner"
    >
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

    <!-- Group: Basic info -->
    <section class="space-y-4">
      <header>
        <h3 class="text-sm font-semibold text-white">Thông tin cơ bản</h3>
        <p class="text-xs text-muted mt-0.5">Tên, địa chỉ và trạng thái hoạt động của toà nhà.</p>
      </header>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiInput
          id="bf-name"
          :model-value="modelValue.name"
          label="Tên tòa nhà"
          placeholder="Ví dụ: Sunrise Tower"
          required
          :error="errorFor('name')"
          @update:model-value="(v) => update('name', v as string)"
          @blur="onBlur('name')"
        />
        <UiSelect
          id="bf-status"
          :model-value="modelValue.status"
          label="Trạng thái"
          :options="statusOptions"
          :error="errorFor('status')"
          @update:model-value="(v) => update('status', v as BuildingFormData['status'])"
        />
        <div class="sm:col-span-2">
          <UiInput
            id="bf-address"
            :model-value="modelValue.address"
            label="Địa chỉ"
            placeholder="Số nhà, tên đường, quận/huyện, tỉnh/thành"
            required
            :error="errorFor('address')"
            @update:model-value="(v) => update('address', v as string)"
            @blur="onBlur('address')"
          />
        </div>
        <div class="sm:col-span-2">
          <UiTextarea
            id="bf-description"
            :model-value="modelValue.description"
            label="Mô tả"
            placeholder="Ghi chú nội bộ về toà nhà — vị trí, đặc điểm, lưu ý cho quản lý."
            :rows="3"
            :error="errorFor('description')"
            @update:model-value="(v) => update('description', v as string)"
            @blur="onBlur('description')"
          />
        </div>
      </div>
    </section>

    <div class="border-t border-dark-border" />

    <!-- Group: Owner contact -->
    <section class="space-y-4">
      <header>
        <h3 class="text-sm font-semibold text-white">Chủ sở hữu</h3>
        <p class="text-xs text-muted mt-0.5">Liên hệ chính cho việc vận hành — tất cả đều tuỳ chọn.</p>
      </header>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UiInput
          id="bf-owner-name"
          :model-value="modelValue.ownerName"
          label="Tên chủ nhà"
          placeholder="Nguyễn Văn A"
          :error="errorFor('owner_name')"
          @update:model-value="(v) => update('ownerName', v as string)"
          @blur="onBlur('owner_name')"
        />
        <UiInput
          id="bf-owner-phone"
          :model-value="modelValue.ownerPhone"
          type="tel"
          label="Số điện thoại"
          placeholder="0901234567"
          :error="errorFor('owner_phone')"
          @update:model-value="(v) => update('ownerPhone', v as string)"
          @blur="onBlur('owner_phone')"
        />
        <UiInput
          id="bf-owner-email"
          :model-value="modelValue.ownerEmail"
          type="email"
          label="Email"
          placeholder="owner@example.com"
          :error="errorFor('owner_email')"
          @update:model-value="(v) => update('ownerEmail', v as string)"
          @blur="onBlur('owner_email')"
        />
      </div>
    </section>

    <div class="border-t border-dark-border" />

    <!-- Group: Billing defaults -->
    <section class="space-y-4">
      <header>
        <h3 class="text-sm font-semibold text-white">Tính phí mặc định</h3>
        <p class="text-xs text-muted mt-0.5">Áp dụng cho mọi phòng trong toà — có thể ghi đè ở từng hợp đồng.</p>
      </header>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiSelect
          id="bf-electricity-pricing"
          :model-value="modelValue.electricityPricingType"
          label="Cách tính tiền điện"
          :options="electricityPricingOptions"
          :error="errorFor('electricity_pricing_type')"
          @update:model-value="(v) => update('electricityPricingType', v as BuildingFormData['electricityPricingType'])"
        />
        <UiInput
          id="bf-electricity-rate"
          :model-value="modelValue.defaultElectricityRate"
          label="Đơn giá điện"
          type="number"
          number-mode="currency"
          placeholder="Ví dụ: 3800"
          :error="errorFor('default_electricity_rate')"
          @update:model-value="(v) => update('defaultElectricityRate', v as string)"
          @blur="onBlur('default_electricity_rate')"
        >
          <template #suffix>đ / kWh</template>
        </UiInput>
        <UiSelect
          id="bf-water-pricing"
          :model-value="modelValue.waterPricingType"
          label="Cách tính tiền nước"
          :options="waterPricingOptions"
          :error="errorFor('water_pricing_type')"
          @update:model-value="(v) => update('waterPricingType', v as BuildingFormData['waterPricingType'])"
        />
        <UiInput
          id="bf-water-rate"
          :model-value="modelValue.defaultWaterRate"
          label="Đơn giá nước"
          type="number"
          number-mode="currency"
          placeholder="Ví dụ: 25000"
          :error="errorFor('default_water_rate')"
          @update:model-value="(v) => update('defaultWaterRate', v as string)"
          @blur="onBlur('default_water_rate')"
        >
          <template #suffix>đ</template>
        </UiInput>
      </div>
    </section>

    <div class="border-t border-dark-border" />

    <!-- Group: Schedule -->
    <section class="space-y-4">
      <header>
        <h3 class="text-sm font-semibold text-white">Lịch vận hành</h3>
        <p class="text-xs text-muted mt-0.5">Các mốc trong tháng cho chốt số, lập hoá đơn và thu tiền.</p>
      </header>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <UiDatePicker
          id="bf-operational-start-period"
          v-model="operationalStartPeriod"
          label="Tháng bắt đầu"
          placeholder="Tuỳ chọn"
          picker-mode="month"
          :error="operationalStartError"
          @blur="onOperationalStartBlur"
        />
        <UiInput
          id="bf-meter-reading-day"
          :model-value="modelValue.meterReadingDay"
          label="Chốt số"
          type="number"
          number-mode="day"
          placeholder="1–31"
          :error="errorFor('meter_reading_day')"
          @update:model-value="(v) => update('meterReadingDay', v as string)"
          @blur="onBlur('meter_reading_day')"
        >
          <template #suffix>ngày</template>
        </UiInput>
        <UiInput
          id="bf-billing-day"
          :model-value="modelValue.billingGenerationDay"
          label="Lập hoá đơn"
          type="number"
          number-mode="day"
          placeholder="1–31"
          :error="errorFor('billing_generation_day')"
          @update:model-value="(v) => update('billingGenerationDay', v as string)"
          @blur="onBlur('billing_generation_day')"
        >
          <template #suffix>ngày</template>
        </UiInput>
        <UiInput
          id="bf-due-day"
          :model-value="modelValue.paymentDueDay"
          label="Đến hạn"
          type="number"
          number-mode="day"
          placeholder="1–31"
          :error="errorFor('payment_due_day')"
          @update:model-value="(v) => update('paymentDueDay', v as string)"
          @blur="onBlur('payment_due_day')"
        >
          <template #suffix>ngày</template>
        </UiInput>
        <UiInput
          id="bf-grace-days"
          :model-value="modelValue.gracePeriodDays"
          label="Gia hạn"
          type="number"
          number-mode="integer"
          placeholder="0"
          :error="errorFor('grace_period_days')"
          @update:model-value="(v) => update('gracePeriodDays', v as string)"
          @blur="onBlur('grace_period_days')"
        >
          <template #suffix>ngày</template>
        </UiInput>
      </div>
    </section>

    <!-- Extension slot for page-specific groups (e.g. quick rooms on create). -->
    <slot name="extras" />

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
