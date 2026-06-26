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

async function confirmDelete() {
  isDeleting.value = true
  try {
    await $fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    await navigateTo('/contracts')
  }
  finally {
    isDeleting.value = false
    showDeleteModal.value = false
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
      <UiPageHeader title="Hợp đồng">
        <div class="flex items-center gap-2 mt-1">
          <UiStatusBadge :status="contract.status" />
          <span class="text-xs text-muted font-mono">{{ contract.contractCode }}</span>
        </div>
        <template #actions>
          <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0 flex-wrap justify-end">
            <UiButton
              v-if="contract.status === 'active' || contract.status === 'expired'"
              variant="secondary"
              size="sm"
              @click="showRenewalForm = !showRenewalForm"
            >
              Gia hạn
            </UiButton>
            <NuxtLink :to="`${contractPath(contract)}/edit`">
              <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
            </NuxtLink>
            <UiButton variant="danger" size="sm" @click="showDeleteModal = true">Xoá</UiButton>
          </div>
        </template>
      </UiPageHeader>

      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Ngày bắt đầu</p>
            <p class="text-sm text-white">{{ new Date(contract.startDate).toLocaleDateString('vi-VN') }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày kết thúc</p>
            <p class="text-sm text-white">{{ new Date(contract.endDate).toLocaleDateString('vi-VN') }}</p>
            <p v-if="contract.originalEndDate && contract.originalEndDate !== contract.endDate" class="text-xs text-muted mt-0.5">
              Nguyên bản: {{ new Date(contract.originalEndDate).toLocaleDateString('vi-VN') }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Giá thuê / tháng</p>
            <p class="text-sm text-white font-medium">{{ formatCurrency(contract.monthlyRent) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Tiền đặt cọc</p>
            <p class="text-sm text-white">{{ formatCurrency(contract.deposit) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(contract.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
        </div>
        <div v-if="contract.notes">
          <p class="text-xs text-muted mb-1">Ghi chú</p>
          <p class="text-sm text-white">{{ contract.notes }}</p>
        </div>
      </div>

      <!-- Room section -->
      <UiSection title="Phòng" class="mt-6">
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <NuxtLink
            :to="`/rooms/${contract.room.id}`"
            class="text-sm font-medium text-white hover:text-cyan transition-colors"
          >
            Phòng {{ contract.room.roomNumber }}
          </NuxtLink>
          <p class="text-sm text-muted mt-0.5">Tầng {{ contract.room.floor }} — {{ contract.room.buildingName }}</p>
        </div>
      </UiSection>

      <!-- Tenant section -->
      <UiSection title="Khách thuê" class="mt-6">
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <NuxtLink
            :to="`/tenants/${contract.tenant.id}`"
            class="text-sm font-medium text-white hover:text-cyan transition-colors"
          >
            {{ contract.tenant.fullName }}
          </NuxtLink>
          <p class="text-sm text-muted mt-0.5">{{ contract.tenant.phone }}</p>
        </div>
      </UiSection>

      <!-- Occupants section -->
      <UiSection title="Người ở" class="mt-6">
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
      <UiSection title="Thanh toán hợp đồng" description="Ghi nhận đặt cọc, trả trước và các khoản phát sinh khi ký hợp đồng. Không dùng cho thanh toán hóa đơn hàng tháng." class="mt-6">
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
      <UiSection title="Dịch vụ hàng tháng" class="mt-6">
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <ContractServicesTab
            :services="contractServices"
            :loading="servicesLoading"
            @update="updateContractService"
          />
        </div>
      </UiSection>

      <!-- Handover readings section -->
      <UiSection title="Số bàn giao" class="mt-6">
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
      <UiSection v-if="showRenewalForm" title="Gia hạn hợp đồng" class="mt-6">
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
      <UiSection title="Lịch sử gia hạn" class="mt-6">
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
