<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import { buildingContractProfileSchema, type BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'
import { formatPaymentWindow } from '~/utils/format/payment-window'

const props = defineProps<{
  profile: BuildingContractProfile | null
  building: Building
  canEdit: boolean
  saving: boolean
  error: string | null
  editPath: string
}>()
const emit = defineEmits<{ save: [input: BuildingContractProfileInput] }>()

const toForm = (p: BuildingContractProfile | null) => ({
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
})

const form = reactive(toForm(props.profile))
watch(() => props.profile, value => Object.assign(form, toForm(value)))

const fieldErrors = ref<Record<string, string>>({})
const paymentWindow = computed(() => formatPaymentWindow(props.building))

const HIDDEN = 'Ẩn với vai trò quản lý'
const displayIdNumber = computed(() => props.profile?.lessorIdNumber ?? '—')
const displayDob = computed(() => (props.profile?.lessorIdentityMasked ? HIDDEN : (props.profile?.lessorDateOfBirth ?? '—')))
const displayAddress = computed(() => (props.profile?.lessorIdentityMasked ? HIDDEN : (props.profile?.lessorPermanentAddress ?? '—')))

function submit() {
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
  <div class="space-y-5">
    <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    <UiAlert v-if="!canEdit" severity="info">
      Chỉ chủ nhà và admin có thể cập nhật. Quản lý đang xem bản chỉ đọc; số CMND/CCCD được che.
    </UiAlert>

    <!-- Read-only (manager) view -->
    <div v-if="!canEdit" class="space-y-5">
      <UiFormSection
        title="Bên cho thuê (người ký hợp đồng)"
        description="Thông tin này in trên hợp đồng, khác với thông tin liên hệ chủ nhà."
      >
        <UiDefinitionList>
          <UiDefinitionItem label="Họ tên">{{ profile?.lessorFullName ?? '—' }}</UiDefinitionItem>
          <UiDefinitionItem label="Ngày sinh">{{ displayDob }}</UiDefinitionItem>
          <UiDefinitionItem label="Địa chỉ thường trú">{{ displayAddress }}</UiDefinitionItem>
          <UiDefinitionItem label="Số CMND/CCCD">{{ displayIdNumber }}</UiDefinitionItem>
          <UiDefinitionItem label="Ngày cấp">{{ profile?.lessorIdIssuedDate ?? '—' }}</UiDefinitionItem>
          <UiDefinitionItem label="Nơi cấp">{{ profile?.lessorIdIssuedPlace ?? '—' }}</UiDefinitionItem>
          <UiDefinitionItem label="Số điện thoại">{{ profile?.lessorPhone ?? '—' }}</UiDefinitionItem>
        </UiDefinitionList>
      </UiFormSection>
    </div>

    <!-- Editable (owner/admin) view -->
    <div v-else class="space-y-5">
      <UiFormSection
        title="Bên cho thuê (người ký hợp đồng)"
        description="Thông tin này in trên hợp đồng, khác với thông tin liên hệ chủ nhà."
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <div data-test="lessor-full-name">
            <UiInput v-model="form.lessor_full_name" label="Họ tên" :error="fieldErrors.lessor_full_name" />
          </div>
          <UiInput v-model="form.lessor_phone" label="Số điện thoại" :error="fieldErrors.lessor_phone" />
          <UiInput v-model="form.lessor_date_of_birth" label="Ngày sinh" type="date" :error="fieldErrors.lessor_date_of_birth" />
          <UiInput v-model="form.lessor_id_number" label="Số CMND/CCCD" :error="fieldErrors.lessor_id_number" />
          <UiInput v-model="form.lessor_id_issued_date" label="Ngày cấp" type="date" :error="fieldErrors.lessor_id_issued_date" />
          <UiInput v-model="form.lessor_id_issued_place" label="Nơi cấp" :error="fieldErrors.lessor_id_issued_place" />
          <div class="sm:col-span-2">
            <UiInput v-model="form.lessor_permanent_address" label="Địa chỉ thường trú" :error="fieldErrors.lessor_permanent_address" />
          </div>
        </div>
      </UiFormSection>

      <UiFormSection title="Mặc định cho hợp đồng mới">
        <div class="grid gap-3 sm:grid-cols-3">
          <UiInput v-model="form.default_term_months" label="Thời hạn (tháng)" type="number" number-mode="integer" placeholder="12" :error="fieldErrors.default_term_months" />
          <UiInput v-model="form.default_deposit_months" label="Số tháng cọc" type="number" placeholder="1" :error="fieldErrors.default_deposit_months" />
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

      <UiFormSection title="Bản ký">
        <div class="grid gap-3 sm:grid-cols-2">
          <UiInput v-model="form.signed_copies" label="Số bản ký" type="number" number-mode="integer" :error="fieldErrors.signed_copies" />
          <UiInput v-model="form.copies_per_party" label="Số bản mỗi bên giữ" type="number" number-mode="integer" :error="fieldErrors.copies_per_party" />
        </div>
      </UiFormSection>
    </div>

    <!-- Payment window preview (both roles) -->
    <UiFormSection title="Lịch thanh toán trên hợp đồng (chỉ đọc)">
      <template v-if="paymentWindow">
        <p class="text-sm text-ui-primary">Trên hợp đồng: {{ paymentWindow.sentence }}</p>
        <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ui-muted">
          <span>Ngày phát hành hóa đơn: {{ paymentWindow.startDay }}</span>
          <span>Hạn thanh toán: {{ paymentWindow.endDay }}</span>
          <span>Số ngày ân hạn: {{ paymentWindow.graceDays }}</span>
        </div>
        <NuxtLink :to="editPath" class="mt-2 inline-block text-xs text-ui-accent hover:underline">Sửa lịch vận hành</NuxtLink>
      </template>
      <template v-else>
        <UiAlert severity="warning">
          Chưa đủ lịch thanh toán. Cài đặt ngày phát hành hóa đơn và hạn thanh toán trước.
        </UiAlert>
        <NuxtLink :to="editPath" class="mt-2 inline-block text-xs text-ui-accent hover:underline">Sửa lịch vận hành</NuxtLink>
      </template>
    </UiFormSection>

    <div v-if="canEdit" class="flex justify-end border-t border-ui-border pt-4">
      <UiButton data-test="contract-profile-save" :loading="saving" :disabled="saving" @click="submit">
        Lưu thông tin hợp đồng
      </UiButton>
    </div>
  </div>
</template>
