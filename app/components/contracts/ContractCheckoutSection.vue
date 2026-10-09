<script setup lang="ts">
import type { Invoice } from '~/types/billing'
import type { CheckoutBundle, CheckoutDraftInput, CheckoutPreview } from '~/types/checkout'
import type { CheckoutActions } from '~/composables/contracts/useContractCheckout'
import { checkoutDraftSchema, checkoutRefundSchema, checkoutCreditSchema, checkoutChargeSchema, checkoutCorrectionSchema, checkoutChargeModesSchema } from '~/utils/validators/checkout'
import { formatCurrency } from '~/utils/format/currency'
import { getApiErrorMessage } from '~/utils/api-error'
import { invoicePath } from '~/utils/routes/operational'
import { checkoutBlockerMessage } from '~/utils/checkout'

const props = withDefaults(defineProps<{
  bundle: CheckoutBundle | null
  loading: boolean
  error: string | null
  contractCode: string
  contractStatus?: string
  /** Caller-controlled visibility gate (e.g. hide on a freshly-active contract). Defaults to always visible. */
  visible?: boolean
  canManage: boolean
  canSettle: boolean
  canIssue: boolean
  canRefund: boolean
  canCorrect?: boolean
  actions: CheckoutActions
}>(), {
  visible: true,
})
const emit = defineEmits<{ retry: []; changed: [] }>()
const pending = ref(false)
const actionError = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const preview = ref<CheckoutPreview | null>(null)
const confirmation = ref<'return' | 'settle' | 'issue' | 'refund' | 'correction' | null>(null)
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const draft = reactive({ date: today(), reason: '', electricity: '', electricityOverride: '', electricityReason: '', water: '', waterOverride: '', waterReason: '' })
const refundForm = reactive({ amount: '', paid_at: today(), payment_method: 'cash', note: '' })
const showCorrection = ref(false)
const correctionInvoice = ref<Invoice | null>(null)
const correctionForm = reactive({ invoice_id: '', amount: '', label: '', reason: '' })
const correctionOptions = computed(() => (props.bundle?.invoices ?? props.bundle?.statement?.preview.invoices ?? []).map(invoice => ({ value: invoice.id, label: invoice.code || invoice.id })))
watch(() => correctionForm.invoice_id, () => { correctionInvoice.value = null })
const chargeForm = reactive({ label: '', amount: '', note: '' })
const creditForm = reactive({ payment_id: '', amount: '', reason: '' })
const meters = [{ key: 'electricity' as const, label: 'Điện', unit: 'kWh' }, { key: 'water' as const, label: 'Nước', unit: 'm³' }]
const paymentMethods = [{ value: 'cash', label: 'Tiền mặt' }, { value: 'bank_transfer', label: 'Chuyển khoản' }]
const draftDirty = computed(() => {
  const saved = props.bundle?.checkout
  if (!saved) return true
  if (draft.date !== saved.actualReturnDate || draft.reason !== saved.reason) return true
  return meters.some(({ key }) => draft[key] !== (saved[key] ? String(saved[key]!.reading) : '') || draft[`${key}Override`] !== (saved[key]?.usageOverride == null ? '' : String(saved[key]!.usageOverride)) || draft[`${key}Reason`] !== (saved[key]?.reason ?? ''))
})
const returned = computed(() => props.bundle?.checkout?.status === 'returned')
const settlementPilot = computed(() => props.bundle?.checkout?.financialMode === 'settlement')
const legacyReturn = computed(() => props.bundle?.checkout?.financialMode === 'legacy')
const statement = computed(() => props.bundle?.statement ?? null)
const breakdown = computed(() => statement.value?.preview ?? props.bundle?.finalBill?.preview ?? preview.value)
const pricing = computed(() => props.bundle?.checkout?.pricingSnapshot as {
  monthlyRent: number
  building: { electricityPricingType: string; waterPricingType: string; electricityRate: number; waterRate: number }
  services: Array<{ id: string; label: string; amount: number; quantity: number }>
} | null | undefined)
const recurringRows = computed(() => {
  if (!pricing.value) return []
  const rows = [{ key: 'rent', label: 'Tiền phòng', monthly: Number(pricing.value.monthlyRent) }]
  const b = pricing.value.building
  if (['fixed', 'per_person'].includes(b.electricityPricingType)) rows.push({ key: 'electricity_fixed', label: 'Điện cố định', monthly: Number(b.electricityRate) })
  if (['fixed_per_room', 'per_person'].includes(b.waterPricingType)) rows.push({ key: 'water_fixed', label: 'Nước cố định', monthly: Number(b.waterRate) })
  for (const service of pricing.value.services ?? []) rows.push({ key: `service:${service.id}`, label: service.label, monthly: Number(service.amount) * Number(service.quantity) })
  return rows
})
const chargeModes = reactive<Record<string, { mode: 'prorated' | 'full_month' | 'waived'; reason: string }>>({})
const modeOptions = [{ value: 'prorated', label: 'Theo ngày' }, { value: 'full_month', label: 'Cả tháng' }, { value: 'waived', label: 'Miễn thu' }]
const modeDirty = computed(() => recurringRows.value.some(row => {
  const saved = props.bundle?.checkout?.chargeModes?.[row.key]
  const local = chargeModes[row.key]
  return local && (local.mode !== (saved?.mode ?? 'prorated') || local.reason !== (saved?.reason ?? ''))
}))
const sourceOptions = computed(() => (props.bundle?.sources ?? []).filter(s => s.amount > s.approvedAmount && ['prepaid_rent', 'other'].includes(s.paymentType)).map(s => ({ value: s.id, label: `${s.paymentType === 'prepaid_rent' ? 'Thu trước' : 'Thu khác'} · ${s.id.slice(0, 8)} · còn ${formatCurrency(s.amount - s.approvedAmount)}` })))
const financialLabel = computed(() => legacyReturn.value
  ? props.bundle?.statement ? 'Biên bản lịch sử' : 'Chờ đối soát lịch sử'
  : settlementPilot.value
  ? ({ unsettled: 'Chưa quyết toán', awaiting_payment: 'Còn phải thu', awaiting_refund: 'Còn phải hoàn', settled: 'Đã tất toán' }[statement.value?.financialStatus ?? 'unsettled'])
  : props.bundle?.finalBill ? 'Đã lập hóa đơn cuối' : 'Chờ bảng tính cuối')

watch(() => props.bundle?.checkout, value => {
  if (!value) return
  draft.date = value.actualReturnDate
  draft.reason = value.reason
  for (const { key } of meters) {
    draft[key] = value[key] ? String(value[key]!.reading) : ''
    draft[`${key}Override`] = value[key]?.usageOverride == null ? '' : String(value[key]!.usageOverride)
    draft[`${key}Reason`] = value[key]?.reason ?? ''
  }
  for (const row of recurringRows.value) {
    const saved = value.chargeModes?.[row.key]
    chargeModes[row.key] = { mode: saved?.mode ?? 'prorated', reason: saved?.reason ?? '' }
  }
}, { immediate: true })
watch(() => props.bundle?.statement?.remainingRefund, value => { if (value != null) refundForm.amount = String(value) }, { immediate: true })
watch(() => props.bundle, () => { preview.value = null })

function draftInput(): CheckoutDraftInput {
  const input: CheckoutDraftInput = { actual_return_date: draft.date, reason: draft.reason, expected_updated_at: props.bundle?.checkout?.updatedAt }
  for (const { key } of meters) {
    input[key] = draft[key] === '' ? null : { reading: Number(draft[key]), usageOverride: draft[`${key}Override`] === '' ? null : Number(draft[`${key}Override`]), reason: draft[`${key}Reason`] || null }
  }
  return input
}

async function run(action: () => Promise<unknown>, success?: string, options?: { silent?: boolean }) {
  if (pending.value) return
  pending.value = true
  actionError.value = null
  successMessage.value = null
  try {
    await action()
    confirmation.value = null
    successMessage.value = success ?? null
    if (!options?.silent) emit('changed')
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Không thể hoàn thành thao tác. Kiểm tra dữ liệu và thử lại.')
    // A failed confirmation may have become stale while another operator changed billing.
    if (confirmation.value === 'settle') preview.value = null
    confirmation.value = null
  } finally { pending.value = false }
}

async function saveDraft() {
  fieldErrors.value = {}
  for (const { key } of meters) {
    if (draft[key] === '' && (draft[`${key}Override`] !== '' || draft[`${key}Reason`] !== '')) fieldErrors.value[`${key}.reading`] = 'Nhập chỉ số chốt trước khi điều chỉnh lượng dùng'
  }
  if (Object.keys(fieldErrors.value).length) return
  const result = checkoutDraftSchema.safeParse(draftInput())
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[issue.path.join('.')] = issue.message
    return
  }
  await run(() => props.actions.save(result.data), 'Đã lưu thông tin trả phòng')
}
async function addCharge() {
  fieldErrors.value = {}
  const result = checkoutChargeSchema.safeParse({ ...chargeForm, amount: Number(chargeForm.amount), operation_id: crypto.randomUUID() })
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[`charge.${issue.path.join('.')}`] = issue.message
    return
  }
  await run(() => props.actions.addCharge({ label: result.data.label, amount: result.data.amount, note: result.data.note ?? undefined }), 'Đã thêm phí phát sinh')
  if (!actionError.value) { chargeForm.label = ''; chargeForm.amount = ''; chargeForm.note = '' }
}
// Read-only: must not emit 'changed', which would refresh the parent contract
// and remount this whole section, discarding the preview just loaded.
async function loadPreview() {
  await run(async () => { preview.value = await props.actions.preview() }, undefined, { silent: true })
}
async function saveChargeModes() {
  if (!props.bundle?.checkout) return
  fieldErrors.value = {}
  const modes = Object.fromEntries(recurringRows.value.map((row) => {
    const choice = chargeModes[row.key] ?? { mode: 'prorated', reason: '' }
    return [row.key, { mode: choice.mode, reason: choice.mode === 'waived' ? choice.reason : null }]
  }))
  const result = checkoutChargeModesSchema.safeParse({ expected_updated_at: props.bundle.checkout.updatedAt, modes })
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[`modes.${issue.path.join('.')}`] = issue.message
    return
  }
  await run(() => props.actions.saveChargeModes(result.data), 'Đã lưu cách tính tháng cuối')
}
function requestRefund() {
  const result = checkoutRefundSchema.safeParse({ ...refundForm, amount: Number(refundForm.amount), operation_id: crypto.randomUUID() })
  fieldErrors.value = {}
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[issue.path.join('.')] = issue.message
    return
  }
  if (result.data.amount > (statement.value?.remainingRefund ?? 0)) { fieldErrors.value.amount = 'Số tiền vượt quá khoản còn phải hoàn'; return }
  confirmation.value = 'refund'
}
async function approveCredit() {
  fieldErrors.value = {}
  const result = checkoutCreditSchema.safeParse({ ...creditForm, amount: Number(creditForm.amount), operation_id: crypto.randomUUID() })
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[`credit.${issue.path.join('.')}`] = issue.message
    return
  }
  await run(() => props.actions.approveCredit({ payment_id: result.data.payment_id, amount: result.data.amount, reason: result.data.reason }), 'Đã duyệt tiền bù trừ')
  if (!actionError.value) { creditForm.amount = ''; creditForm.reason = '' }
}
async function previewCorrection() {
  fieldErrors.value = {}
  await run(async () => {
    const detail = await props.actions.loadCorrectionInvoice(correctionForm.invoice_id)
    const result = checkoutCorrectionSchema.safeParse({ ...correctionForm, amount: Number(correctionForm.amount), expected_updated_at: detail.invoice.updatedAt, operation_id: crypto.randomUUID() })
    if (!result.success) {
      for (const issue of result.error.issues) fieldErrors.value[`correction.${issue.path.join('.')}`] = issue.message
      return
    }
    if (detail.invoice.totalAmount + result.data.amount < detail.invoice.paidAmount) {
      actionError.value = 'Điều chỉnh giảm vượt số tiền chưa thu. Cần đối chiếu khoản đã thu trước khi giảm thêm.'
      return
    }
    correctionInvoice.value = detail.invoice
  })
  if (correctionInvoice.value && !actionError.value) confirmation.value = 'correction'
}
async function confirmAction() {
  if (confirmation.value === 'return' && !draftDirty.value) await run(() => props.actions.confirmReturn(), 'Đã xác nhận trả phòng')
  else if (confirmation.value === 'settle' && preview.value && preview.value.blockers.length === 0) await run(() => props.actions.confirm(preview.value!.snapshotHash), 'Đã xác nhận quyết toán')
  else if (confirmation.value === 'issue' && preview.value && preview.value.blockers.length === 0) await run(() => props.actions.issueFinal(preview.value!.snapshotHash), 'Đã phát hành các khoản cuối còn thiếu')
  else if (confirmation.value === 'correction' && correctionInvoice.value) await run(() => props.actions.correct({ invoice_id: correctionForm.invoice_id, amount: Number(correctionForm.amount), label: correctionForm.label, reason: correctionForm.reason, expected_updated_at: correctionInvoice.value!.updatedAt }), 'Đã ghi nhận điều chỉnh quyết toán')
  else if (confirmation.value === 'refund') await run(() => props.actions.refund({ ...refundForm, amount: Number(refundForm.amount) }), 'Đã ghi nhận khoản hoàn tiền')
}
const confirmationContent = computed(() => {
  if (confirmation.value === 'return') return { title: 'Xác nhận trả phòng', label: 'Xác nhận trả phòng', message: `Phòng và người ở sẽ được giải phóng theo ngày ${draft.date}. Thông tin bàn giao sẽ được khoá; quyết toán tiền là bước tiếp theo.` }
  if (confirmation.value === 'settle') return { title: 'Xác nhận quyết toán', label: 'Xác nhận quyết toán', message: `Bù trừ ${formatCurrency(preview.value?.depositApplied ?? 0)} tiền cọc và ${formatCurrency(preview.value?.creditApplied ?? 0)} tiền đã duyệt. Biên bản sẽ được lưu cố định; còn phải hoàn ${formatCurrency(preview.value?.refundDue ?? 0)}, còn phải thu ${formatCurrency(preview.value?.additionalDue ?? 0)}.` }
  if (confirmation.value === 'issue') return { title: 'Phát hành tiền tháng cuối', label: 'Phát hành', message: `Phát hành ${formatCurrency(preview.value?.finalChargesTotal ?? 0)} khoản cuối còn thiếu. Các dòng hóa đơn đã lập và khoản đã thu được giữ nguyên.` }
  if (confirmation.value === 'correction') return { title: 'Xác nhận điều chỉnh quyết toán', label: 'Ghi nhận điều chỉnh', message: `Hoá đơn ${correctionInvoice.value?.invoiceCode}: điều chỉnh ${formatCurrency(Number(correctionForm.amount))}. Tổng sau điều chỉnh ${formatCurrency((correctionInvoice.value?.totalAmount ?? 0) + Number(correctionForm.amount))}, đã thu ${formatCurrency(correctionInvoice.value?.paidAmount ?? 0)}. Lý do: ${correctionForm.reason}. Biên bản ban đầu và khoản đã hoàn được giữ nguyên.` }
  return { title: 'Ghi nhận khoản đã hoàn', label: 'Ghi nhận đã hoàn', message: `Xác nhận đã hoàn thực tế ${formatCurrency(Number(refundForm.amount))} cho khách thuê. Thao tác này chỉ ghi sổ, không chuyển tiền.` }
})
</script>

<template>
  <UiSection v-if="visible && (loading || error || bundle?.enabled)" id="checkout" title="Kết thúc hợp đồng" class="mt-6 scroll-mt-20" tabindex="-1">
    <UiSurfacePanel density="compact">
      <div v-if="loading" class="space-y-3"><UiSkeleton class="h-8 w-full" /><UiSkeleton class="h-32 w-full" /></div>
      <UiAlert v-else-if="error" severity="danger">
        {{ error }} <UiButton size="sm" variant="secondary" class="mt-2" @click="emit('retry')">Thử lại</UiButton>
      </UiAlert>
      <div v-else-if="bundle?.enabled" class="space-y-5">
        <p class="text-xs font-medium tracking-wide text-ui-muted">{{ legacyReturn ? 'Hồ sơ trả phòng lịch sử' : settlementPilot || bundle.settlementEnabled ? 'Bàn giao → Bảng tính cuối → Quyết toán → Hoàn tiền' : 'Bàn giao → Bảng tính cuối → Phát hành hóa đơn' }}</p>
        <UiAlert v-if="actionError" severity="danger" role="alert">{{ actionError }}</UiAlert>
        <p v-if="successMessage" role="status" class="text-sm text-status-success">{{ successMessage }}</p>
        <UiAlert v-if="!bundle.checkout && contractStatus === 'terminated'" severity="info">Hợp đồng đã kết thúc theo luồng cũ. Hồ sơ này không tự chuyển thành quyết toán pilot; cần đối soát hóa đơn và cọc theo lịch sử hiện có.</UiAlert>
        <UiAlert v-if="legacyReturn" severity="info">Hồ sơ đã trả phòng theo phiên bản trước. Hóa đơn, cọc và biên bản cũ được giữ nguyên; cần đối soát lịch sử trước khi xử lý thêm tiền.</UiAlert>
        <div v-if="!returned && contractStatus !== 'terminated'" class="space-y-4">
          <p class="text-sm text-ui-muted">Ghi ngày trả, lý do và chỉ số cuối. Tiền tháng cuối được đối chiếu sau khi bàn giao; ngày kết thúc đã ký được giữ nguyên.</p>
          <form v-if="canManage" class="space-y-4" novalidate @submit.prevent="saveDraft">
            <div class="grid gap-3 sm:grid-cols-2">
              <UiDatePicker v-model="draft.date" label="Ngày trả thực tế" date-mode="operational" :error="fieldErrors.actual_return_date" :disabled="pending" required />
              <UiTextarea v-model="draft.reason" label="Lý do trả phòng" :rows="2" :error="fieldErrors.reason" :disabled="pending" required />
            </div>
            <div v-for="meter in meters" :key="meter.key" class="space-y-3 border-t border-ui-border pt-3">
              <h3 class="text-sm font-medium text-ui-primary">{{ meter.label }} cuối kỳ ({{ meter.unit }})</h3>
              <div class="grid gap-3 sm:grid-cols-3">
                <UiInput v-model="draft[meter.key]" label="Chỉ số chốt" type="number" number-mode="meter" :error="fieldErrors[`${meter.key}.reading`]" :disabled="pending" hint="Để trống nếu không sử dụng đồng hồ này" />
                <UiInput v-model="draft[`${meter.key}Override`]" label="Điều chỉnh lượng dùng" type="number" number-mode="meter" :error="fieldErrors[`${meter.key}.usageOverride`]" :disabled="pending" hint="Chỉ nhập khi cần thay lượng dùng tính từ chỉ số" />
                <UiInput v-model="draft[`${meter.key}Reason`]" label="Lý do điều chỉnh" :error="fieldErrors[`${meter.key}.reason`]" :disabled="pending" />
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <UiButton type="submit" size="sm" :loading="pending">Lưu bàn giao</UiButton>
              <UiButton v-if="bundle.checkout" type="button" size="sm" variant="secondary" :disabled="pending || draftDirty" @click="confirmation = 'return'">Xác nhận trả phòng</UiButton>
            </div>
            <p v-if="bundle.checkout" class="text-xs text-ui-muted">Xác nhận sử dụng bản đã lưu. Hãy lưu lại trước nếu vừa chỉnh thông tin.</p>
          </form>
          <p v-else class="text-sm text-ui-muted">Người có quyền quản lý hợp đồng cần lưu và xác nhận bàn giao trước khi quyết toán.</p>
        </div>
        <div v-else-if="returned" class="flex flex-wrap items-center justify-between gap-3">
          <div><h3 class="text-sm font-medium text-ui-primary">Đã bàn giao phòng · {{ bundle.checkout?.actualReturnDate }}</h3><p class="mt-1 text-sm text-ui-muted">{{ bundle.checkout?.reason }}</p></div>
          <p class="text-sm font-medium text-ui-primary">{{ financialLabel }}</p>
        </div>
        <UiAlert v-if="returned && settlementPilot && bundle.settlementEnabled === false && !statement" severity="warning">Quyết toán của tòa nhà đang tạm dừng. Bảng tính vẫn xem được; cần bật lại pilot sau khi đối soát để xác nhận.</UiAlert>
        <dl v-if="returned" class="grid gap-3 text-sm sm:grid-cols-2">
          <template v-for="meter in meters" :key="meter.key">
            <div v-if="bundle.checkout?.[meter.key]">
              <dt class="text-xs text-ui-muted">{{ meter.label }} chốt</dt>
              <dd class="mt-1 text-ui-primary">{{ bundle.checkout[meter.key]!.reading }} {{ meter.unit }}<span v-if="bundle.checkout[meter.key]!.usageOverride != null"> · Lượng dùng điều chỉnh: {{ bundle.checkout[meter.key]!.usageOverride }} {{ meter.unit }}</span></dd>
              <dd v-if="bundle.checkout[meter.key]!.reason" class="mt-1 break-words text-xs text-ui-muted">{{ bundle.checkout[meter.key]!.reason }}</dd>
            </div>
          </template>
        </dl>
        <div v-if="returned && !legacyReturn && !statement && !bundle.finalBill" class="space-y-4 border-t border-ui-border pt-4">
          <div class="space-y-3">
            <div>
              <h3 class="text-sm font-semibold text-ui-primary">Bảng tính tháng cuối</h3>
              <p class="mt-1 text-xs text-ui-muted">Mặc định tính đến hết ngày trả. Chọn cách tính cho từng khoản chưa lập hóa đơn; miễn thu cần có lý do.</p>
            </div>
            <div v-for="row in recurringRows" :key="row.key" class="grid gap-2 border-b border-ui-border pb-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div>
                <p class="text-sm font-medium text-ui-primary">{{ row.label }}</p>
                <p class="text-xs text-ui-muted">Giá tại lúc trả phòng: {{ formatCurrency(row.monthly) }}/tháng</p>
              </div>
              <UiSelect v-if="chargeModes[row.key]" v-model="chargeModes[row.key]!.mode" :label="`Cách tính ${row.label}`" :options="modeOptions" :disabled="pending || !canManage" />
              <UiInput v-if="chargeModes[row.key]?.mode === 'waived'" v-model="chargeModes[row.key]!.reason" label="Lý do miễn thu" :error="fieldErrors[`modes.modes.${row.key}.reason`]" :disabled="pending || !canManage" class="sm:col-span-2" required />
            </div>
            <UiButton v-if="canManage && recurringRows.length" size="sm" variant="secondary" :disabled="pending || !modeDirty" :loading="pending" @click="saveChargeModes">Lưu cách tính</UiButton>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-ui-muted">Đối chiếu hóa đơn đã lập, nợ cũ và phí phát sinh trước khi phát hành khoản cuối.</p>
            <NuxtLink to="/dashboard/billing" class="text-sm text-ui-accent hover:underline focus-visible:ring-2 focus-visible:ring-ui-accent/40">Mở kỳ hoá đơn</NuxtLink>
          </div>
          <form v-if="canIssue" class="space-y-3" novalidate @submit.prevent="addCharge">
            <h3 class="text-sm font-medium text-ui-primary">Phí phát sinh khi trả phòng</h3>
            <div class="grid gap-3 sm:grid-cols-3">
              <UiInput v-model="chargeForm.label" label="Tên khoản phí" :error="fieldErrors['charge.label']" :disabled="pending" required />
              <UiInput v-model="chargeForm.amount" label="Số tiền" type="number" number-mode="currency" :error="fieldErrors['charge.amount']" :disabled="pending" required />
              <UiInput v-model="chargeForm.note" label="Ghi chú" :error="fieldErrors['charge.note']" :disabled="pending" />
            </div>
            <UiButton type="submit" variant="secondary" size="sm" :loading="pending">Thêm phí phát sinh</UiButton>
          </form>
          <form v-if="settlementPilot && bundle.settlementEnabled !== false && canSettle && sourceOptions.length" class="space-y-3" novalidate @submit.prevent="approveCredit">
            <h3 class="text-sm font-medium text-ui-primary">Duyệt tiền bù trừ từ phiếu thu</h3>
            <p class="text-xs text-ui-muted">Chỉ tiền thu trước hoặc khoản thu khác được duyệt có lý do mới được bù trừ.</p>
            <div class="grid gap-3 sm:grid-cols-3">
              <UiSelect v-model="creditForm.payment_id" label="Phiếu thu nguồn" :options="sourceOptions" :error="fieldErrors['credit.payment_id']" :disabled="pending" />
              <UiInput v-model="creditForm.amount" label="Số tiền duyệt" type="number" number-mode="currency" :error="fieldErrors['credit.amount']" :disabled="pending" />
              <UiInput v-model="creditForm.reason" label="Lý do duyệt" :error="fieldErrors['credit.reason']" :disabled="pending" />
            </div>
            <UiButton type="submit" variant="secondary" size="sm" :loading="pending">Duyệt tiền bù trừ</UiButton>
          </form>
          <UiButton v-if="canIssue || (settlementPilot && bundle.settlementEnabled !== false && canSettle)" size="sm" variant="secondary" :loading="pending" :disabled="modeDirty" @click="loadPreview">Xem bảng tính cuối</UiButton>
        </div>
        <div v-if="breakdown" class="space-y-4 border-t border-ui-border pt-4">
          <h3 class="text-sm font-semibold text-ui-primary">{{ statement ? `Biên bản ${statement.code}` : bundle.finalBill ? 'Đã phát hành tiền tháng cuối' : 'Đối chiếu trước khi xác nhận' }}</h3>
          <dl class="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div
v-for="row in [
              ['Cọc đang giữ', breakdown.depositHeld],
              ...(settlementPilot ? [['Tiền bù trừ đã duyệt', breakdown.creditHeld]] : []),
              ['Đã thu vào hóa đơn', breakdown.cashCollected ?? 0], ['Nợ hóa đơn cũ', breakdown.existingDebt], ['Khoản cuối chưa lập hóa đơn', breakdown.finalChargesTotal],
              ...(settlementPilot ? [['Cọc bù trừ', breakdown.depositApplied], ['Tiền đã duyệt bù trừ', breakdown.creditApplied]] : []),
            ]" :key="String(row[0])" class="flex min-w-0 justify-between gap-3"><dt class="text-ui-muted">{{ row[0] }}</dt><dd class="shrink-0 tabular-nums text-ui-primary">{{ formatCurrency(Number(row[1])) }}</dd></div>
          </dl>
          <p v-if="!settlementPilot" class="text-xs text-ui-muted">Tiền cọc được giữ riêng; phát hành hóa đơn cuối không tự cấn trừ.</p>
          <ul v-if="breakdown.charges.length" class="divide-y divide-ui-border text-sm">
            <li v-for="charge in breakdown.charges" :key="charge.key" class="flex justify-between gap-3 py-2"><span class="text-ui-muted">{{ charge.label }} · {{ charge.quantity }} × {{ formatCurrency(charge.unitPrice) }}</span><span class="shrink-0 tabular-nums text-ui-primary">{{ formatCurrency(charge.amount) }}</span></li>
          </ul>
          <div v-if="breakdown.billedCharges?.length" class="space-y-1 text-xs text-ui-muted">
            <p class="font-medium">Đã lập hóa đơn, không tính lại</p>
            <p v-for="line in breakdown.billedCharges" :key="line.key" class="flex justify-between gap-3"><span>{{ line.label }}</span><span class="tabular-nums">{{ formatCurrency(line.amount) }}</span></p>
          </div>
          <p v-for="line in breakdown.waivedCharges ?? []" :key="line.key" class="text-xs text-ui-muted">Miễn thu {{ line.label }} · {{ line.reason }}</p>
          <div v-if="settlementPilot" class="flex flex-wrap gap-x-8 gap-y-3 border-t border-ui-border pt-3">
            <div><p class="text-xs text-ui-muted">Cần hoàn{{ statement ? ' còn lại' : '' }}</p><p class="text-xl font-semibold tabular-nums text-ui-primary">{{ formatCurrency(statement?.remainingRefund ?? breakdown.refundDue) }}</p></div>
            <div><p class="text-xs text-ui-muted">Cần thu{{ statement ? ' còn lại' : '' }}</p><p class="text-xl font-semibold tabular-nums text-ui-primary">{{ formatCurrency(statement?.outstandingDebt ?? breakdown.additionalDue) }}</p></div>
          </div>
          <ul v-if="(bundle.invoices ?? breakdown.invoices).length" class="space-y-2 text-sm">
            <li v-for="invoice in (bundle.invoices ?? breakdown.invoices)" :key="invoice.id"><NuxtLink :to="invoicePath({ id: invoice.id, code: invoice.code })" class="text-ui-accent hover:underline focus-visible:ring-2 focus-visible:ring-ui-accent/40">{{ invoice.code || 'Hoá đơn' }} · {{ formatCurrency(invoice.balance) }} · Mở ghi thu</NuxtLink></li>
          </ul>
          <UiAlert v-if="breakdown.blockers.length" severity="warning"><ul class="space-y-1"><li v-for="blocker in breakdown.blockers" :key="blocker">{{ checkoutBlockerMessage(blocker) }}</li></ul></UiAlert>
          <UiButton v-if="!statement && !bundle.finalBill && settlementPilot && bundle.settlementEnabled !== false && canSettle" size="sm" :disabled="pending || modeDirty || breakdown.blockers.length > 0" @click="confirmation = 'settle'">Phát hành và quyết toán</UiButton>
          <UiButton v-if="!statement && !bundle.finalBill && !settlementPilot && canIssue" size="sm" :disabled="pending || modeDirty || breakdown.blockers.length > 0" @click="confirmation = 'issue'">Phát hành khoản cuối</UiButton>
          <div v-if="statement" class="flex flex-wrap gap-3 text-sm">
            <NuxtLink :to="`/dashboard/contracts/${encodeURIComponent(contractCode)}/settlement/print`" target="_blank" class="text-ui-accent hover:underline focus-visible:ring-2 focus-visible:ring-ui-accent/40">In / lưu PDF biên bản</NuxtLink>
            <p class="text-ui-muted">Đã xác nhận: {{ new Date(statement.confirmedAt).toLocaleString('vi-VN') }}</p>
          </div>
        </div>
        <form v-if="statement && !legacyReturn && statement.remainingRefund > 0 && statement.outstandingDebt === 0 && canRefund" class="space-y-3 border-t border-ui-border pt-4" novalidate @submit.prevent="requestRefund">
          <h3 class="text-sm font-medium text-ui-primary">Ghi nhận hoàn tiền</h3>
          <p class="text-xs text-ui-muted">Ghi sổ sau khi đã trả tiền thực tế cho khách. Hệ thống không thực hiện chuyển tiền.</p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UiInput v-model="refundForm.amount" label="Số tiền đã hoàn" type="number" number-mode="currency" :max="statement.remainingRefund" :error="fieldErrors.amount" :disabled="pending" required />
            <UiDatePicker v-model="refundForm.paid_at" label="Ngày hoàn" date-mode="payment" :error="fieldErrors.paid_at" :disabled="pending" required />
            <UiSelect v-model="refundForm.payment_method" label="Phương thức" :options="paymentMethods" :error="fieldErrors.payment_method" :disabled="pending" />
            <UiInput v-model="refundForm.note" label="Ghi chú / tham chiếu" :error="fieldErrors.note" :disabled="pending" />
          </div>
          <UiButton type="submit" size="sm" :loading="pending">Ghi nhận khoản đã hoàn</UiButton>
        </form>
        <UiAlert v-if="statement && statement.remainingRefund > 0 && statement.outstandingDebt > 0" severity="warning">Cần thu hết nợ điều chỉnh trên hoá đơn trước khi ghi nhận thêm khoản hoàn.</UiAlert>
        <div v-if="statement && !legacyReturn && canCorrect" class="space-y-3 border-t border-ui-border pt-4">
          <UiButton size="sm" variant="secondary" :aria-expanded="showCorrection" @click="showCorrection = !showCorrection">Điều chỉnh sau quyết toán</UiButton>
          <form v-if="showCorrection" class="space-y-3" novalidate @submit.prevent="previewCorrection">
            <p class="text-xs text-ui-muted">Tạo khoản điều chỉnh trên hoá đơn của hợp đồng, có lý do và kiểm tra trước khi xác nhận. Biên bản đã chốt và các khoản hoàn thực tế được giữ nguyên.</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <UiSelect v-model="correctionForm.invoice_id" label="Hoá đơn cần điều chỉnh" :options="correctionOptions" :error="fieldErrors['correction.invoice_id']" :disabled="pending" required />
              <UiInput v-model="correctionForm.amount" label="Số tiền điều chỉnh" type="number" number-mode="currency" :min="-999999999999" hint="Số dương để tăng phí; số âm để giảm phí" :error="fieldErrors['correction.amount']" :disabled="pending" required />
              <UiInput v-model="correctionForm.label" label="Tên khoản điều chỉnh" :error="fieldErrors['correction.label']" :disabled="pending" required />
              <UiTextarea v-model="correctionForm.reason" label="Lý do điều chỉnh" :rows="2" :error="fieldErrors['correction.reason']" :disabled="pending" required />
            </div>
            <UiButton type="submit" size="sm" :loading="pending" :disabled="!correctionForm.invoice_id">Kiểm tra điều chỉnh</UiButton>
          </form>
        </div>
        <ul v-if="bundle.refunds.length" class="divide-y divide-ui-border text-sm">
          <li v-for="refund in bundle.refunds" :key="refund.id" class="flex flex-wrap justify-between gap-2 py-2"><span class="text-ui-muted">{{ refund.paidAt }} · {{ refund.paymentMethod }}<span v-if="refund.note"> · {{ refund.note }}</span></span><span class="tabular-nums text-ui-primary">Đã hoàn {{ formatCurrency(refund.amount) }}</span></li>
        </ul>
      </div>
    </UiSurfacePanel>
    <UiConfirmModal :open="confirmation !== null" :title="confirmationContent.title" :message="confirmationContent.message" :confirm-label="confirmationContent.label" :loading="pending" @confirm="confirmAction" @cancel="confirmation = null" />
  </UiSection>
</template>
