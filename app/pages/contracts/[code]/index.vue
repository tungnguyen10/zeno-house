<script setup lang="ts">
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'
import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import { contractPath } from '~/utils/routes/operational'
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'
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
const { services: contractServices, isLoading: servicesLoading, updateService: updateContractService, removeService: removeContractService } = useContractServices(id)

const activeOccupantCount = computed(
  () => occupants.value.filter(o => !o.moveOutDate && o.role === 'roommate').length + 1,
)
const paidAmount = computed(() => payments.value.reduce((sum, p) => sum + p.amount, 0))

const showRenewalForm = ref(false)
const isRenewing = ref(false)
const renewalApiError = ref<string | null>(null)

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
    renewalApiError.value = getApiErrorMessage(err, 'Không thể gia hạn hợp đồng. Vui lòng thử lại.')
  } finally {
    isRenewing.value = false
  }
}

const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteConflict = ref<Record<string, unknown> | null>(null)
const showTerminateModal = ref(false)
const isTerminating = ref(false)

const deletingServiceId = ref<string | null>(null)
const isDeletingService = ref(false)
const deleteServiceReason = ref('')

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
    await apiFetch(`/api/contracts/${id}`, {
      method: 'DELETE',
      query: force ? { force: true } : undefined,
    })
    await navigateTo('/contracts')
  }
  catch (err: unknown) {
    if (getApiErrorCode(err) === 'CONFLICT') {
      deleteConflict.value = getApiErrorDetails<Record<string, unknown>>(err) ?? {}
      showDeleteModal.value = false
      return
    }
    toast.error(getApiErrorMessage(err, 'Không thể xoá hợp đồng. Vui lòng thử lại.'))
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
    await apiFetch(`/api/contracts/${id}`, {
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

async function handleDeleteService() {
  if (!deletingServiceId.value || !deleteServiceReason.value.trim()) return
  isDeletingService.value = true
  try {
    await removeContractService(deletingServiceId.value, deleteServiceReason.value.trim())
    deletingServiceId.value = null
    deleteServiceReason.value = ''
  }
  catch {
    toast.error('Không thể xoá dịch vụ. Vui lòng thử lại.')
  }
  finally {
    isDeletingService.value = false
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
        :can-manage="authStore.can('contracts.update')"
        @edit="navigateTo(`${contractPath(contract)}/edit`)"
        @renew="showRenewalForm = !showRenewalForm"
        @terminate="showTerminateModal = true"
        @delete="showDeleteModal = true"
      />

      <UiAlert v-if="deleteConflict" severity="danger" class="mt-4">
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

      <nav class="sticky top-0 z-20 mt-4 overflow-x-auto border-y border-dark-border bg-dark-deep/95 py-2 backdrop-blur">
        <div class="flex min-w-max gap-2 text-sm">
          <a href="#overview" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Tổng quan</a>
          <a href="#occupants" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Người ở</a>
          <a href="#payments" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Thanh toán</a>
          <a href="#services" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Dịch vụ</a>
          <a href="#meter-readings" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Chỉ số</a>
          <a href="#history" class="rounded-md px-3 py-1.5 text-muted hover:bg-dark-hover hover:text-white">Lịch sử</a>
        </div>
      </nav>

      <ContractOverviewPanel
        :contract="contract"
        :active-occupant-count="activeOccupantCount"
      />

      <ContractOccupantsSection
        :contract="contract"
        :occupants="occupants"
        :is-loading="occupantsLoading"
        :can-manage="authStore.can('contracts.update')"
        :add-occupant="addOccupant"
        :move-out="moveOut"
        :remove-occupant="removeOccupant"
      />

      <ContractPaymentsSection
        :payments="payments"
        :is-loading="paymentsLoading"
        :can-manage="authStore.can('contracts.update')"
        :add-payment="addPayment"
        :update-payment="updatePayment"
        :remove-payment="removePayment"
      />

      <!-- Services section -->
      <UiSection id="services" title="Dịch vụ hàng tháng" class="mt-6 scroll-mt-20">
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <ContractServicesTab
            :services="contractServices"
            :loading="servicesLoading"
            :can-delete="authStore.can('contracts.delete')"
            @update="updateContractService"
            @delete="deletingServiceId = $event"
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

      <!-- Contract history -->
      <UiSection id="history" title="Lịch sử" class="mt-6 scroll-mt-20">
        <div class="rounded-xl border border-dark-border bg-dark-surface p-4">
          <ContractRenewalHistoryList
            :renewals="renewals"
            :is-loading="renewalsLoading"
            :previous-contract-id="contract.previousContractId ?? null"
            :renewal-count="contract.renewalCount"
          />
          <ContractAuditHistory
            class="mt-4"
            :contract-id="contract.id"
            :building-id="contract.buildingId"
          />
        </div>
      </UiSection>
    </template>

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

    <!-- Delete service modal -->
    <div v-if="deletingServiceId" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-sm rounded-xl bg-dark-surface border border-dark-border p-6 space-y-4">
        <h2 class="text-sm font-semibold text-white">Xoá dịch vụ khỏi hợp đồng</h2>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-muted">Lý do xoá <span class="text-error">*</span></label>
          <textarea
            v-model="deleteServiceReason"
            rows="3"
            class="w-full rounded-md border border-dark-border bg-dark-deep px-3 py-2 text-sm text-white placeholder-muted resize-none focus:outline-none focus:ring-1 focus:ring-cyan"
            placeholder="Nhập lý do..."
          />
        </div>
        <div class="flex gap-2">
          <UiButton
            size="sm"
            variant="danger"
            :disabled="!deleteServiceReason.trim()"
            :loading="isDeletingService"
            @click="handleDeleteService"
          >
            Xoá
          </UiButton>
          <UiButton
            size="sm"
            variant="secondary"
            :disabled="isDeletingService"
            @click="deletingServiceId = null; deleteServiceReason = ''"
          >
            Huỷ
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>
