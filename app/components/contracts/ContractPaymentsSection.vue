<script setup lang="ts">
import type { ContractWithDetails } from '~/types/contracts'
import { getApiErrorMessage } from '~/utils/api-error'
import { contractPath } from '~/utils/routes/operational'
import type { ContractPayment } from '~/types/contract-payments'
import type { ContractPaymentCreateInput, ContractPaymentUpdateInput } from '~/utils/validators/contract-payments'
import { formatCurrency } from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'
import { CONTRACT_PAYMENT_TYPE_LABELS } from '~/utils/constants/contracts'

const props = defineProps<{
  contract?: Pick<ContractWithDetails, 'status' | 'successorContract'>
  payments: ContractPayment[]
  isLoading: boolean
  canManage: boolean
  addPayment: (input: ContractPaymentCreateInput) => Promise<ContractPayment>
  updatePayment: (id: string, input: ContractPaymentUpdateInput) => Promise<ContractPayment>
  removePayment: (id: string) => Promise<void>
}>()

const canEditPayments = computed(() => props.canManage && props.contract?.status !== 'renewed')
const deleteApiError = ref<string | null>(null)

const showPaymentForm = ref(false)
const isAddingPayment = ref(false)
const paymentApiError = ref<string | null>(null)

const editingPayment = ref<ContractPayment | null>(null)
const isUpdatingPayment = ref(false)
const editPaymentApiError = ref<string | null>(null)

const deletingPaymentId = ref<string | null>(null)
const isDeletingPayment = ref(false)

async function handleAddPayment(input: ContractPaymentCreateInput) {
  if (!canEditPayments.value || isAddingPayment.value) return
  isAddingPayment.value = true
  paymentApiError.value = null
  try {
    await props.addPayment(input)
    showPaymentForm.value = false
  }
  catch (error) {
    paymentApiError.value = getApiErrorMessage(error, 'Không thể thêm thanh toán. Vui lòng thử lại.')
  }
  finally {
    isAddingPayment.value = false
  }
}

async function handleUpdatePayment(input: ContractPaymentCreateInput) {
  if (!canEditPayments.value || !editingPayment.value || isUpdatingPayment.value) return
  isUpdatingPayment.value = true
  editPaymentApiError.value = null
  try {
    await props.updatePayment(editingPayment.value.id, input)
    editingPayment.value = null
  }
  catch (error) {
    editPaymentApiError.value = getApiErrorMessage(error, 'Không thể cập nhật thanh toán. Vui lòng thử lại.')
  }
  finally {
    isUpdatingPayment.value = false
  }
}

async function handleDeletePayment() {
  if (!canEditPayments.value || !deletingPaymentId.value || isDeletingPayment.value) return
  deleteApiError.value = null
  isDeletingPayment.value = true
  try {
    await props.removePayment(deletingPaymentId.value)
  }
  catch (error) {
    deleteApiError.value = getApiErrorMessage(error, 'Không thể xoá thanh toán. Vui lòng thử lại.')
  }
  finally {
    isDeletingPayment.value = false
    deletingPaymentId.value = null
  }
}
</script>

<template>
  <UiSection
    id="payments"
    title="Thanh toán hợp đồng"
    description="Ghi nhận đặt cọc, trả trước và các khoản phát sinh khi ký hợp đồng. Không dùng cho thanh toán hóa đơn hàng tháng."
    class="mt-6 scroll-mt-20"
  >
    <template #actions>
      <UiButton
        v-if="canEditPayments && !showPaymentForm"
        variant="secondary"
        size="sm"
        @click="showPaymentForm = true"
      >
        + Thêm thanh toán
      </UiButton>
    </template>

    <UiAlert v-if="contract?.status === 'renewed'" severity="info" class="mb-4">
      Hợp đồng đã gia hạn.<template v-if="contract.successorContract"> Tiền cọc đang giữ đã chuyển sang HĐ <NuxtLink :to="contractPath(contract.successorContract)" class="rounded-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40">{{ contract.successorContract.code }}</NuxtLink>.</template>
    </UiAlert>
    <UiAlert v-if="deleteApiError" severity="danger" class="mb-4">{{ deleteApiError }}</UiAlert>
    <!-- Add payment form -->
    <template v-if="canEditPayments && showPaymentForm">
      <ContractPaymentForm
        :loading="isAddingPayment"
        :api-error="paymentApiError"
        class="mb-4"
        @submit="handleAddPayment"
        @cancel="showPaymentForm = false; paymentApiError = null"
      />
      <hr class="border-ui-border mb-4">
    </template>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-2">
      <UiSkeleton class="h-10 rounded-lg" />
      <UiSkeleton class="h-10 rounded-lg" />
    </div>
    <div v-else-if="payments.length === 0" class="text-sm text-ui-muted text-center py-4">
      Chưa có thanh toán nào được ghi nhận.
    </div>
    <div v-else class="space-y-2">
      <template v-for="payment in payments" :key="payment.id">
        <!-- Inline edit form -->
        <div v-if="canEditPayments && editingPayment?.id === payment.id" class="rounded-lg border border-ui-accent/40 p-4">
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
          class="flex items-start justify-between rounded-lg border border-ui-border px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium text-ui-primary">{{ CONTRACT_PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType }}</p>
            <p class="text-xs text-ui-muted mt-0.5">
              {{ formatViDate(payment.paidAt) }}
              <template v-if="payment.coveredPeriodStart">
                · Kỳ {{ payment.coveredPeriodStart }}
                <template v-if="payment.coveredPeriodEnd && payment.coveredPeriodEnd !== payment.coveredPeriodStart">
                  → {{ payment.coveredPeriodEnd }}
                </template>
              </template>
              <template v-if="payment.paymentMethod"> · {{ payment.paymentMethod }}</template>
            </p>
            <p v-if="payment.note" class="text-xs text-ui-muted mt-0.5 italic">{{ payment.note }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-4">
            <p class="text-sm font-semibold text-ui-accent">{{ formatCurrency(payment.amount) }}</p>
            <template v-if="canEditPayments">
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
                class="text-status-danger hover:text-status-danger"
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

  <!-- Delete payment modal -->
  <UiConfirmModal
    :open="canEditPayments && !!deletingPaymentId"
    title="Xoá thanh toán"
    message="Bạn có chắc muốn xoá khoản thanh toán này? Hành động này không thể hoàn tác."
    :loading="isDeletingPayment"
    @confirm="handleDeletePayment"
    @cancel="deletingPaymentId = null"
  />
</template>
