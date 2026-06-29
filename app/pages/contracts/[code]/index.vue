<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'
import type { ContractPaymentCreateInput } from '~/utils/validators/contract-payments'
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'
import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import { contractPath } from '~/utils/routes/operational'
import { isUuid } from '~/utils/format/slug'

definePageMeta({ title: 'Chi tiết hợp đồng' })

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()
const id = route.params.code as string

// Redirect UUID-based URLs to code-based canonical URL
if (isUuid(id)) {
  const { data: redirectData } = await useFetch<ApiSuccess<ContractWithDetails>>(`/api/contracts/${id}`)
  if (redirectData.value?.data) {
    await navigateTo(contractPath(redirectData.value.data), { replace: true })
  }
}

const { contract, isLoading, error, refresh: refreshContract } = useContractDetail(id)
const { payments, isLoading: paymentsLoading, addPayment, updatePayment, removePayment } = useContractPayments(id)
const { renewals, isLoading: renewalsLoading, renew } = useContractRenewals(id)
const { occupants, isLoading: occupantsLoading, addOccupant, moveOut, removeOccupant } = useContractOccupants(id)
const { services: contractServices, isLoading: servicesLoading, updateService: updateContractService } = useContractServices(id)

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('vi-VN')
}

const activeOccupantCount = computed(
  () => occupants.value.filter(o => !o.moveOutDate).length + 1,
)
const paidAmount = computed(() => payments.value.reduce((sum, payment) => sum + payment.amount, 0))

type LifecycleTone = 'default' | 'warning' | 'danger' | 'muted'
const lifecycle = computed<{ percent: number, label: string, tone: LifecycleTone } | null>(() => {
  if (!contract.value) return null
  const c = contract.value
  if (c.status === 'terminated') return { percent: 100, label: 'Đã kết thúc trước hạn', tone: 'danger' }
  if (c.status === 'renewed') return { percent: 100, label: 'Đã gia hạn', tone: 'muted' }

  const start = new Date(c.startDate).getTime()
  const end = new Date(c.endDate).getTime()
  const now = Date.now()
  const total = end - start
  const elapsed = now - start
  const percent = total <= 0 ? 100 : Math.max(0, Math.min(100, (elapsed / total) * 100))
  const day = 24 * 60 * 60 * 1000
  const remainingDays = Math.ceil((end - now) / day)

  if (remainingDays <= 0) return { percent: 100, label: 'Đã hết hạn', tone: 'warning' }
  if (remainingDays <= 30) return { percent, label: `Còn ${remainingDays} ngày`, tone: 'warning' }
  const monthsRemaining = Math.round(remainingDays / 30)
  return {
    percent,
    label: monthsRemaining === 1 ? 'Còn 1 tháng' : `Còn ${monthsRemaining} tháng`,
    tone: 'default',
  }
})

const lifecycleBarClass: Record<LifecycleTone, string> = {
  default: 'bg-cyan',
  warning: 'bg-warning',
  danger: 'bg-error-vivid',
  muted: 'bg-dark-hover',
}
const lifecycleTextClass: Record<LifecycleTone, string> = {
  default: 'text-white',
  warning: 'text-warning',
  danger: 'text-error-vivid',
  muted: 'text-muted',
}

const showPaymentForm = ref(false)
const isAddingPayment = ref(false)
const paymentApiError = ref<string | null>(null)

const editingPayment = ref<import('~/types/contract-payments').ContractPayment | null>(null)
const isUpdatingPayment = ref(false)
const editPaymentApiError = ref<string | null>(null)

const deletingPaymentId = ref<string | null>(null)
const isDeletingPayment = ref(false)

const showRenewalForm = ref(false)
const isRenewing = ref(false)
const renewalApiError = ref<string | null>(null)

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: 'Đặt cọc',
  prepaid_rent: 'Trả trước tiền thuê',
  rent: 'Tiền thuê',
  other: 'Khác',
}

async function handleUpdatePayment(input: import('~/utils/validators/contract-payments').ContractPaymentCreateInput) {
  if (!editingPayment.value) return
  isUpdatingPayment.value = true
  editPaymentApiError.value = null
  try {
    await updatePayment(editingPayment.value.id, input)
    editingPayment.value = null
  } catch {
    editPaymentApiError.value = 'Không thể cập nhật thanh toán. Vui lòng thử lại.'
  } finally {
    isUpdatingPayment.value = false
  }
}

async function handleDeletePayment() {
  if (!deletingPaymentId.value) return
  isDeletingPayment.value = true
  try {
    await removePayment(deletingPaymentId.value)
  } finally {
    isDeletingPayment.value = false
    deletingPaymentId.value = null
  }
}

const RENEWAL_MODE_LABELS: Record<string, string> = {
  extend: 'Gia hạn tại chỗ',
  new_contract: 'Hợp đồng mới',
}

async function handleAddPayment(input: ContractPaymentCreateInput) {
  isAddingPayment.value = true
  paymentApiError.value = null
  try {
    await addPayment(input)
    showPaymentForm.value = false
  } catch {
    paymentApiError.value = 'Không thể thêm thanh toán. Vui lòng thử lại.'
  } finally {
    isAddingPayment.value = false
  }
}

async function handleRenew(input: ContractRenewInput) {
  isRenewing.value = true
  renewalApiError.value = null
  try {
    const renewal = await renew(input)
    showRenewalForm.value = false
    // If new contract was created, navigate to it
    if (renewal.newContractId) {
              await navigateTo(`/contracts/${renewal.newContractId}`)
    } else {
      await refreshContract()
    }
  } catch (err: unknown) {
    const fetchErr = err as {
      data?: { error?: { message?: string }, message?: string, statusMessage?: string }
      statusMessage?: string
      message?: string
    }
    renewalApiError.value
      = fetchErr?.data?.error?.message
      ?? fetchErr?.data?.message
      ?? fetchErr?.data?.statusMessage
      ?? fetchErr?.statusMessage
      ?? fetchErr?.message
      ?? 'Không thể gia hạn hợp đồng. Vui lòng thử lại.'
  } finally {
    isRenewing.value = false
  }
}

const showOccupantForm = ref(false)
const isAddingOccupant = ref(false)
const occupantApiError = ref<string | null>(null)

const moveOutOccupantId = ref<string | null>(null)
const moveOutDate = ref(new Date().toISOString().slice(0, 10))
const isMovingOut = ref(false)

const deletingOccupantId = ref<string | null>(null)
const isDeletingOccupant = ref(false)

async function handleAddOccupant(input: import('~/utils/validators/contract-occupants').ContractOccupantAddInput) {
  isAddingOccupant.value = true
  occupantApiError.value = null
  try {
    await addOccupant(input)
    showOccupantForm.value = false
  } catch {
    occupantApiError.value = 'Không thể thêm người ở. Vui lòng thử lại.'
  } finally {
    isAddingOccupant.value = false
  }
}

async function handleMoveOut() {
  if (!moveOutOccupantId.value) return
  isMovingOut.value = true
  try {
    await moveOut(moveOutOccupantId.value, { move_out_date: moveOutDate.value })
    moveOutOccupantId.value = null
  } catch {
    // keep modal open on error
  } finally {
    isMovingOut.value = false
  }
}

async function handleDeleteOccupant() {
  if (!deletingOccupantId.value) return
  isDeletingOccupant.value = true
  try {
    await removeOccupant(deletingOccupantId.value)
  } finally {
    isDeletingOccupant.value = false
    deletingOccupantId.value = null
  }
}

const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteConflict = ref<Record<string, unknown> | null>(null)
const showTerminateModal = ref(false)
const isTerminating = ref(false)

const conflictItems = computed(() => {
  const details = deleteConflict.value
  if (!details) return []
  const items: string[] = []
  if (details.reason === 'ACTIVE_CONTRACT') items.push('Hợp đồng đang hiệu lực')
  if (Number(details.issuedBillingPeriods ?? 0) > 0) items.push(`${details.issuedBillingPeriods} kỳ hoá đơn đã phát hành`)
  if (Number(details.paidPayments ?? 0) > 0) items.push(`${details.paidPayments} khoản thanh toán đã thu`)
  if (Number(details.nonHandoverMeterReadings ?? 0) > 0) items.push(`${details.nonHandoverMeterReadings} chỉ số ngoài bàn giao`)
  return items
})

const onlyActiveConflict = computed(() =>
  deleteConflict.value?.reason === 'ACTIVE_CONTRACT'
  && !deleteConflict.value?.issuedBillingPeriods
  && !deleteConflict.value?.paidPayments
  && !deleteConflict.value?.nonHandoverMeterReadings,
)

async function confirmDelete(force = false) {
  isDeleting.value = true
  deleteConflict.value = null
  try {
    await $fetch(`/api/contracts/${id}`, {
      method: 'DELETE',
      query: force ? { force: true } : undefined,
    })
    await navigateTo('/contracts')
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { error?: { code?: string, details?: Record<string, unknown>, message?: string } } }
    if (fetchErr.data?.error?.code === 'CONFLICT') {
      deleteConflict.value = fetchErr.data.error.details ?? {}
      showDeleteModal.value = false
      return
    }
    toast.error(fetchErr.data?.error?.message ?? 'Không thể xoá hợp đồng. Vui lòng thử lại.')
  }
  finally {
    isDeleting.value = false
    if (!deleteConflict.value) showDeleteModal.value = false
  }
}

async function confirmTerminate() {
  if (!contract.value) return
  isTerminating.value = true
  try {
    await $fetch(`/api/contracts/${id}`, {
      method: 'PATCH',
      body: { status: 'terminated' },
    })
    toast.success('Đã kết thúc hợp đồng')
    showTerminateModal.value = false
    await refreshContract()
  }
  catch {
    toast.error('Không thể kết thúc hợp đồng. Vui lòng thử lại.')
  }
  finally {
    isTerminating.value = false
  }
}

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/contracts')
})
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isLoading" class="space-y-4">
      <UiSkeleton class="h-8 w-64 rounded-lg" />
      <UiSkeleton class="h-48 rounded-xl" />
    </div>

    <!-- Error -->
    <UiAlert v-else-if="error && error.statusCode !== 404" severity="danger">
      Không thể tải thông tin hợp đồng.
    </UiAlert>

    <!-- Detail -->
    <template v-else-if="contract">
      <UiPageHeader
        title="Chi tiết hợp đồng"
        :back-to="'/contracts'"
        back-label="Danh sách hợp đồng"
      />

      <ContractDetailHero
        :contract="contract"
        :paid-amount="paidAmount"
        @renew="showRenewalForm = !showRenewalForm"
        @terminate="showTerminateModal = true"
      />

      <nav class="sticky top-0 z-20 mt-4 overflow-x-auto border-y border-dark-border bg-dark-deep/95 py-2 backdrop-blur">
        <div class="flex min-w-max gap-2 text-sm">
          <a href="#overview" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Tổng quan</a>
          <a href="#occupants" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Người ở</a>
          <a href="#payments" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Thanh toán</a>
          <a href="#services" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Dịch vụ</a>
          <a href="#renewals" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Gia hạn</a>
          <a href="#meter-readings" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Chỉ số</a>
          <a v-if="authStore.isAdmin" href="#danger-zone" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Quản trị</a>
        </div>
      </nav>

      <div id="overview" class="mt-6 scroll-mt-20 rounded-xl border border-dark-border bg-dark-surface p-6 space-y-5">
        <!-- Lifecycle ribbon -->
        <div v-if="lifecycle">
          <div class="flex items-end justify-between text-xs mb-2">
            <div>
              <p class="text-muted uppercase tracking-wide">Bắt đầu</p>
              <p class="text-white tabular-nums mt-0.5">{{ formatDate(contract.startDate) }}</p>
            </div>
            <p :class="['text-sm font-medium tabular-nums', lifecycleTextClass[lifecycle.tone]]">
              {{ lifecycle.label }}
            </p>
            <div class="text-right">
              <p class="text-muted uppercase tracking-wide">Kết thúc</p>
              <p class="text-white tabular-nums mt-0.5">{{ formatDate(contract.endDate) }}</p>
              <p
                v-if="contract.originalEndDate && contract.originalEndDate !== contract.endDate"
                class="text-muted tabular-nums mt-0.5"
              >
                gốc {{ formatDate(contract.originalEndDate) }}
              </p>
            </div>
          </div>
          <div class="relative h-1.5 rounded-full bg-dark-border overflow-hidden">
            <div
              :class="['absolute inset-y-0 left-0 rounded-full transition-[width]', lifecycleBarClass[lifecycle.tone]]"
              :style="{ width: `${lifecycle.percent}%` }"
            />
          </div>
        </div>

        <!-- KPI strip -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Giá thuê / tháng</p>
            <p class="text-xl font-semibold text-white tabular-nums">{{ formatCurrency(contract.monthlyRent) }}</p>
          </div>
          <div class="space-y-1 sm:border-l sm:border-dark-border sm:pl-4">
            <p class="text-xs uppercase tracking-wide text-muted">Tiền đặt cọc</p>
            <p class="text-xl font-semibold text-white tabular-nums">{{ formatCurrency(contract.deposit) }}</p>
          </div>
          <div class="space-y-1 sm:border-l sm:border-dark-border sm:pl-4">
            <p class="text-xs uppercase tracking-wide text-muted">Người ở</p>
            <p class="text-xl font-semibold text-white tabular-nums">
              {{ activeOccupantCount }}<span class="text-sm text-muted font-normal">/{{ contract.occupantCount }}</span>
            </p>
          </div>
        </div>

        <div v-if="contract.notes" class="pt-4 border-t border-dark-border">
          <p class="text-xs uppercase tracking-wide text-muted mb-1">Ghi chú</p>
          <p class="text-sm text-white">{{ contract.notes }}</p>
        </div>
      </div>

      <!-- Occupants section -->
      <UiSection id="occupants" title="Người ở" class="mt-6 scroll-mt-20">
        <template #actions>
          <div class="flex items-center gap-2">
            <template v-if="!occupantsLoading">
              <!-- +1 for primary tenant -->
              <span
                v-if="(occupants.filter(o => !o.moveOutDate).length + 1) > contract.occupantCount"
                class="text-xs text-amber-400 border border-amber-400/40 rounded px-1.5 py-0.5"
                title="Vượt số người trong hợp đồng"
              >
                {{ occupants.filter(o => !o.moveOutDate).length + 1 }}/{{ contract.occupantCount }} ⚠
              </span>
              <span v-else class="text-xs text-muted">
                {{ occupants.filter(o => !o.moveOutDate).length + 1 }}/{{ contract.occupantCount }}
              </span>
            </template>
            <UiButton
              v-if="authStore.isAdmin && !showOccupantForm"
              variant="secondary"
              size="sm"
              @click="showOccupantForm = true"
            >
              + Thêm người ở
            </UiButton>
          </div>
        </template>

        <!-- Add form -->
        <div v-if="showOccupantForm" class="mb-4 rounded-lg border border-dark-border p-4">
          <ContractOccupantForm
            :exclude-tenant-ids="[
              contract.tenantId,
              ...occupants.filter(o => !o.moveOutDate).map(o => o.tenantId),
            ]"
            :loading="isAddingOccupant"
            :api-error="occupantApiError"
            @submit="handleAddOccupant"
            @cancel="showOccupantForm = false; occupantApiError = null"
          />
        </div>

        <!-- Primary tenant (from contract) -->
        <div v-if="contract.tenant" class="flex items-center gap-3 rounded-lg border border-dark-border px-4 py-3 mb-2">
          <div class="size-8 rounded-full bg-cyan/10 flex items-center justify-center shrink-0">
            <span class="text-cyan text-xs font-bold">{{ contract.tenant.fullName.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <NuxtLink :to="`/tenants/${contract.tenant.id}`" class="text-sm font-medium text-white hover:text-cyan transition-colors">
              {{ contract.tenant.fullName }}
            </NuxtLink>
            <p class="text-xs text-muted mt-0.5">{{ contract.tenant.phone }}</p>
          </div>
          <span class="text-xs text-zinc-400 border border-dark-border rounded px-2 py-0.5 shrink-0">Người thuê chính</span>
        </div>

        <!-- Roommate list -->
        <div v-if="occupantsLoading" class="space-y-2 mt-2">
          <UiSkeleton class="h-12 rounded-lg" />
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="occ in occupants.filter(o => o.role === 'roommate')"
            :key="occ.id"
            :class="[
              'flex items-center gap-3 rounded-lg border px-4 py-3',
              occ.moveOutDate ? 'border-dark-border opacity-50' : 'border-dark-border',
            ]"
          >
            <div class="size-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <span class="text-zinc-400 text-xs font-bold">{{ occ.tenantName?.charAt(0).toUpperCase() ?? '?' }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-white">{{ occ.tenantName ?? occ.tenantId.slice(0, 8) + '…' }}</p>
              <p class="text-xs text-muted mt-0.5">
                <template v-if="occ.tenantPhone">{{ occ.tenantPhone }} · </template>
                Vào {{ new Date(occ.moveInDate).toLocaleDateString('vi-VN') }}
                <template v-if="occ.moveOutDate">
                  · Rời {{ new Date(occ.moveOutDate).toLocaleDateString('vi-VN') }}
                </template>
              </p>
            </div>
              <template v-if="authStore.isAdmin">
                <UiButton
                  v-if="!occ.moveOutDate"
                  variant="ghost"
                  size="sm"
                  @click="moveOutOccupantId = occ.id; moveOutDate = new Date().toISOString().slice(0, 10)"
                >
                  Ghi nhận rời
                </UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="text-red-400 hover:text-red-300"
                  @click="deletingOccupantId = occ.id"
                >
                  Xoá
                </UiButton>
              </template>
          </div>
          <p v-if="occupants.filter(o => o.role === 'roommate').length === 0 && !showOccupantForm" class="text-sm text-muted text-center py-3">
            Chưa có người ở chung nào.
          </p>
        </div>
      </UiSection>

      <!-- Payments section -->
      <UiSection id="payments" title="Thanh toán hợp đồng" description="Ghi nhận đặt cọc, trả trước và các khoản phát sinh khi ký hợp đồng. Không dùng cho thanh toán hóa đơn hàng tháng." class="mt-6 scroll-mt-20">
        <template #actions>
          <UiButton
            v-if="authStore.isAdmin && !showPaymentForm"
            variant="secondary"
            size="sm"
            @click="showPaymentForm = true"
          >
            + Thêm thanh toán
          </UiButton>
        </template>

        <!-- Add payment form -->
        <template v-if="showPaymentForm">
          <ContractPaymentForm
            :loading="isAddingPayment"
            :api-error="paymentApiError"
            class="mb-4"
            @submit="handleAddPayment"
            @cancel="showPaymentForm = false; paymentApiError = null"
          />
          <hr class="border-dark-border mb-4" >
        </template>

        <!-- Payments list -->
        <div v-if="paymentsLoading" class="space-y-2">
          <UiSkeleton class="h-10 rounded-lg" />
          <UiSkeleton class="h-10 rounded-lg" />
        </div>
        <div v-else-if="payments.length === 0" class="text-sm text-muted text-center py-4">
          Chưa có thanh toán nào được ghi nhận.
        </div>
        <div v-else class="space-y-2">
          <template v-for="payment in payments" :key="payment.id">
            <!-- Inline edit form -->
            <div v-if="editingPayment?.id === payment.id" class="rounded-lg border border-cyan-800 p-4">
              <ContractPaymentForm
                :initial-data="editingPayment"
                :loading="isUpdatingPayment"
                :api-error="editPaymentApiError"
                @submit="handleUpdatePayment"
                @cancel="editingPayment = null; editPaymentApiError = null"
              />
            </div>
            <!-- Payment row -->
            <div
              v-else
              class="flex items-start justify-between rounded-lg border border-dark-border px-4 py-3"
            >
              <div>
                <p class="text-sm font-medium text-white">{{ PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType }}</p>
                <p class="text-xs text-muted mt-0.5">
                  {{ new Date(payment.paidAt).toLocaleDateString('vi-VN') }}
                  <template v-if="payment.coveredPeriodStart">
                    · Kỳ {{ payment.coveredPeriodStart }}
                    <template v-if="payment.coveredPeriodEnd && payment.coveredPeriodEnd !== payment.coveredPeriodStart">
                      → {{ payment.coveredPeriodEnd }}
                    </template>
                  </template>
                  <template v-if="payment.paymentMethod"> · {{ payment.paymentMethod }}</template>
                </p>
                <p v-if="payment.note" class="text-xs text-zinc-500 mt-0.5 italic">{{ payment.note }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0 ml-4">
                <p class="text-sm font-semibold text-cyan">{{ formatCurrency(payment.amount) }}</p>
                <template v-if="authStore.isAdmin">
                  <UiButton
                    variant="ghost"
                    size="sm"
                    @click="editingPayment = payment; editPaymentApiError = null"
                  >
                    Sửa
                  </UiButton>
                  <UiButton
                    variant="ghost"
                    size="sm"
                    class="text-red-400 hover:text-red-300"
                    @click="deletingPaymentId = payment.id"
                  >
                    Xoá
                  </UiButton>
                </template>
              </div>
            </div>
          </template>
        </div>
      </UiSection>

      <!-- Services section -->
      <UiSection id="services" title="Dịch vụ hàng tháng" class="mt-6 scroll-mt-20">
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <ContractServicesTab
            :services="contractServices"
            :loading="servicesLoading"
            @update="updateContractService"
          />
        </div>
      </UiSection>

      <!-- Handover readings section -->
      <UiSection id="meter-readings" title="Số bàn giao" class="mt-6 scroll-mt-20">
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <ContractHandoverReadings
            :contract-id="id"
            :room-id="contract.room.id"
            :start-date="contract.startDate"
            :end-date="contract.endDate"
            :status="contract.status"
          />
        </div>
      </UiSection>

      <!-- Renewal form inline -->
      <UiSection v-if="showRenewalForm" title="Gia hạn hợp đồng" class="mt-6 scroll-mt-20">
        <div class="rounded-xl border border-cyan-800 bg-dark-surface p-4">
          <ContractRenewalForm
            :current-end-date="contract.endDate"
            :current-monthly-rent="contract.monthlyRent"
            :loading="isRenewing"
            :api-error="renewalApiError"
            @submit="handleRenew"
            @cancel="showRenewalForm = false; renewalApiError = null"
          />
        </div>
      </UiSection>

      <!-- Renewals history -->
      <UiSection id="renewals" title="Lịch sử gia hạn" class="mt-6 scroll-mt-20">
        <template #actions>
          <span v-if="contract.renewalCount > 0" class="text-xs text-zinc-400">{{ contract.renewalCount }} lần</span>
        </template>
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">

        <!-- Previous contract link -->
        <div v-if="contract.previousContractId" class="mb-3 text-xs text-zinc-400">
          Hợp đồng trước:
          <NuxtLink :to="`/contracts/${contract.previousContractId}`" class="text-cyan hover:text-white transition-colors font-mono ml-1">
            {{ contract.previousContractId.slice(0, 8) }}...
          </NuxtLink>
        </div>

        <div v-if="renewalsLoading" class="space-y-2">
          <UiSkeleton class="h-10 rounded-lg" />
        </div>
        <div v-else-if="renewals.length === 0" class="text-sm text-muted text-center py-3">
          Chưa có lịch sử gia hạn.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="renewal in renewals"
            :key="renewal.id"
            class="rounded-lg border border-dark-border px-4 py-3"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-white">{{ RENEWAL_MODE_LABELS[renewal.mode] ?? renewal.mode }}</p>
                <p class="text-xs text-muted mt-0.5">
                  {{ new Date(renewal.oldEndDate).toLocaleDateString('vi-VN') }}
                  → {{ new Date(renewal.newEndDate).toLocaleDateString('vi-VN') }}
                </p>
                <p v-if="renewal.oldMonthlyRent !== renewal.newMonthlyRent" class="text-xs text-zinc-400 mt-0.5">
                  Giá: {{ formatCurrency(renewal.oldMonthlyRent) }} → {{ formatCurrency(renewal.newMonthlyRent) }}
                </p>
                <p v-if="renewal.reason" class="text-xs text-zinc-500 italic mt-0.5">{{ renewal.reason }}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-xs text-muted">{{ new Date(renewal.createdAt).toLocaleDateString('vi-VN') }}</p>
                <NuxtLink
                  v-if="renewal.newContractId"
                  :to="`/contracts/${renewal.newContractId}`"
                  class="text-xs text-cyan hover:text-white transition-colors mt-0.5 block"
                >
                  Xem hợp đồng mới →
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
        </div>
      </UiSection>

      <UiSection
        v-if="authStore.isAdmin"
        id="danger-zone"
        title="Quản trị hợp đồng"
        description="Các thao tác thay đổi vòng đời hoặc xoá dữ liệu hợp đồng."
        class="mt-6 scroll-mt-20"
      >
        <UiAlert v-if="deleteConflict" severity="danger" class="mb-4">
          <div class="space-y-3">
            <div>
              <p class="text-sm font-medium text-white">Chưa thể xoá hợp đồng</p>
              <ul class="mt-2 space-y-1 text-sm text-muted">
                <li v-for="item in conflictItems" :key="item">- {{ item }}</li>
              </ul>
            </div>
            <div class="flex flex-wrap gap-2">
              <UiButton
                v-if="onlyActiveConflict"
                size="sm"
                variant="danger"
                :loading="isDeleting"
                @click="confirmDelete(true)"
              >
                Kết thúc rồi xoá
              </UiButton>
              <UiButton size="sm" variant="secondary" @click="deleteConflict = null">
                Đã hiểu
              </UiButton>
            </div>
          </div>
        </UiAlert>

        <div class="flex flex-wrap gap-2">
          <NuxtLink :to="`${contractPath(contract)}/edit`">
            <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
          </NuxtLink>
          <UiButton
            v-if="contract.status === 'active' || contract.status === 'expired'"
            variant="secondary"
            size="sm"
            @click="showRenewalForm = !showRenewalForm"
          >
            Gia hạn
          </UiButton>
          <UiButton
            v-if="contract.status === 'active'"
            variant="secondary"
            size="sm"
            @click="showTerminateModal = true"
          >
            Kết thúc sớm
          </UiButton>
          <UiButton variant="danger" size="sm" @click="showDeleteModal = true">
            Xoá
          </UiButton>
        </div>
      </UiSection>
    </template>

    <!-- Move-out modal -->
    <div v-if="moveOutOccupantId" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-sm rounded-xl bg-dark-surface border border-dark-border p-6 space-y-4">
        <h2 class="text-sm font-semibold text-white">Ghi nhận ngày rời phòng</h2>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-muted">Ngày rời</label>
          <UiInput
            v-model="moveOutDate"
            type="date"
            class="w-full"
          />
        </div>
        <div class="flex gap-2">
          <UiButton size="sm" :loading="isMovingOut" @click="handleMoveOut">Xác nhận</UiButton>
          <UiButton size="sm" variant="secondary" :disabled="isMovingOut" @click="moveOutOccupantId = null">Huỷ</UiButton>
        </div>
      </div>
    </div>

    <!-- Delete occupant modal -->
    <UiConfirmModal
      :open="!!deletingOccupantId"
      title="Xoá người ở"
      message="Bạn có chắc muốn xoá người ở này? Hành động này không thể hoàn tác."
      :loading="isDeletingOccupant"
      @confirm="handleDeleteOccupant"
      @cancel="deletingOccupantId = null"
    />

    <!-- Delete contract modal -->
    <UiConfirmModal
      :open="showDeleteModal"
      title="Xác nhận xoá"
      message="Bạn có chắc muốn xoá hợp đồng này? Hành động này không thể hoàn tác."
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />

    <UiConfirmModal
      :open="showTerminateModal"
      title="Kết thúc hợp đồng"
      message="Hợp đồng sẽ chuyển sang trạng thái đã chấm dứt và giải phóng phòng/khách thuê theo logic hiện có."
      confirm-label="Kết thúc"
      :loading="isTerminating"
      @confirm="confirmTerminate"
      @cancel="showTerminateModal = false"
    />

    <!-- Delete payment modal -->
    <UiConfirmModal
      :open="!!deletingPaymentId"
      title="Xoá thanh toán"
      message="Bạn có chắc muốn xoá khoản thanh toán này? Hành động này không thể hoàn tác."
      :loading="isDeletingPayment"
      @confirm="handleDeletePayment"
      @cancel="deletingPaymentId = null"
    />
  </div>
</template>
