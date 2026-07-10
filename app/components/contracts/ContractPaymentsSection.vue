<script setup lang="ts">
import type { ContractPayment } from '~/types/contract-payments'
import type { ContractPaymentCreateInput, ContractPaymentUpdateInput } from '~/utils/validators/contract-payments'
import { formatCurrency } from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'
import { CONTRACT_PAYMENT_TYPE_LABELS } from '~/utils/constants/contracts'

const props = defineProps<{
  payments: ContractPayment[]
  isLoading: boolean
  canManage: boolean
  addPayment: (input: ContractPaymentCreateInput) => Promise<ContractPayment>
  updatePayment: (id: string, input: ContractPaymentUpdateInput) => Promise<ContractPayment>
  removePayment: (id: string) => Promise<void>
}>()

const showPaymentForm = ref(false)
const isAddingPayment = ref(false)
const paymentApiError = ref<string | null>(null)

const editingPayment = ref<ContractPayment | null>(null)
const isUpdatingPayment = ref(false)
const editPaymentApiError = ref<string | null>(null)

const deletingPaymentId = ref<string | null>(null)
const isDeletingPayment = ref(false)

async function handleAddPayment(input: ContractPaymentCreateInput) {
  isAddingPayment.value = true
  paymentApiError.value = null
  try {
    await props.addPayment(input)
    showPaymentForm.value = false
  }
  catch {
    paymentApiError.value = 'Không thể thêm thanh toán. Vui lòng thử lại.'
  }
  finally {
    isAddingPayment.value = false
  }
}

async function handleUpdatePayment(input: ContractPaymentCreateInput) {
  if (!editingPayment.value) return
  isUpdatingPayment.value = true
  editPaymentApiError.value = null
  try {
    await props.updatePayment(editingPayment.value.id, input)
    editingPayment.value = null
  }
  catch {
    editPaymentApiError.value = 'Không thể cập nhật thanh toán. Vui lòng thử lại.'
  }
  finally {
    isUpdatingPayment.value = false
  }
}

async function handleDeletePayment() {
  if (!deletingPaymentId.value) return
  isDeletingPayment.value = true
  try {
    await props.removePayment(deletingPaymentId.value)
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
        v-if="canManage && !showPaymentForm"
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
      <hr class="border-dark-border mb-4">
    </template>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-2">
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
            <p class="text-sm font-medium text-white">{{ CONTRACT_PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType }}</p>
            <p class="text-xs text-muted mt-0.5">
              {{ formatViDate(payment.paidAt) }}
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
            <template v-if="canManage">
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

  <!-- Delete payment modal -->
  <UiConfirmModal
    :open="!!deletingPaymentId"
    title="Xoá thanh toán"
    message="Bạn có chắc muốn xoá khoản thanh toán này? Hành động này không thể hoàn tác."
    :loading="isDeletingPayment"
    @confirm="handleDeletePayment"
    @cancel="deletingPaymentId = null"
  />
</template>
